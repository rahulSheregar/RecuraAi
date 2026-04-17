import { randomUUID } from "node:crypto";

import { eq, gte } from "drizzle-orm";

import { listDoctorProfiles } from "@/lib/db/doctors";
import { appointmentStubs, workflowRuns, workflowStepRuns, emailTemplate } from "@/lib/db/schema";

import { buildIntentPrompt, fetchIntentFromOpenAI, isoToday } from "./intent";
import { parseRunMetadata } from "./metadata";
import { computeSchedulingDecision } from "./scheduling";
import type { ChatExecutorErr, ChatExecutorInput, ChatExecutorOk } from "./types";
import { sendEmail } from "@/lib/email-service/email-service";

function appendTranscriptToEmailBody(
  body: string,
  transcript: string | null | undefined,
): string {
  const t = transcript?.trim();
  if (!t) return body;
  return `${body}\n\n---\nTranscript\n${t}`;
}

export async function executeChatSchedulingWorkflow(
  input: ChatExecutorInput,
): Promise<ChatExecutorOk | ChatExecutorErr> {
  const db = input.db;
  let stepOrder = input.initialStepOrder;

  const startStep = (stepKey: string, stepInput: unknown) => {
    const id = randomUUID();
    db.insert(workflowStepRuns)
      .values({
        id,
        runId: input.runId,
        templateId: input.templateId ?? null,
        stepKey,
        status: "running",
        orderIndex: stepOrder++,
        startedAt: Date.now(),
        inputJson: JSON.stringify(stepInput),
      })
      .run();
    return id;
  };

  const finishStep = (id: string, status: string, output: unknown, error?: string) => {
    db.update(workflowStepRuns)
      .set({
        status,
        finishedAt: Date.now(),
        outputJson: JSON.stringify(output),
        errorMessage: error ?? null,
      })
      .where(eq(workflowStepRuns.id, id))
      .run();
    // If the step failed, fetch the step row and send an alert email.
    if (status === "failed") {
      try {
        const row = db
          .select()
          .from(workflowStepRuns)
          .where(eq(workflowStepRuns.id, id))
          .get();
        // If a template id is attached to the step, try to load it and use it.
        const tmplId = row?.templateId ?? null;
        if (tmplId) {
          const tmpl = db
            .select()
            .from(emailTemplate)
            .where(eq(emailTemplate.id, tmplId))
            .get();
          if (tmpl) {
            // Do not await: keep step persistence synchronous; failures are non-fatal.
            void sendEmail(
              tmpl.subject,
              appendTranscriptToEmailBody(tmpl.content, input.emailTranscript),
              {
                runId: row?.runId ?? null,
                stepId: id,
                templateId: tmplId,
              },
            ).catch(() => {});
            return;
          }
        }
        const subject = `Workflow step failed: ${row?.stepKey ?? id}`;
        const content = appendTranscriptToEmailBody(
          `A workflow step failed.\n\nrunId: ${row?.runId ?? "unknown"}\nstepId: ${id}\nstepKey: ${row?.stepKey ?? "unknown"}\nerror: ${row?.errorMessage ?? error ?? "unknown"}\n\nOutput: ${row?.outputJson ?? JSON.stringify(output)}`,
          input.emailTranscript,
        );
        void sendEmail(subject, content, { runId: row?.runId ?? null, stepId: id }).catch(
          () => {},
        );
      } catch {
        // ignore email failures
      }
    }
  };

  const doctors = listDoctorProfiles();
  const today = isoToday();

  const intentStepId = startStep("extract_intent", {
    today,
    timezone: input.timezone,
    latestUserMessage: input.latestUserMessage,
    doctorCount: doctors.length,
  });

  const extractionPrompt = buildIntentPrompt(
    today,
    input.timezone,
    doctors,
    input.schedulingPromptTemplate,
  );

  const chatHistoryTail = input.chatHistory
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const fetched = await fetchIntentFromOpenAI({
    openaiKey: input.openaiKey,
    model: input.openaiModel,
    extractionPrompt,
    chatHistoryTail,
  });

  if (!fetched.ok) {
    finishStep(intentStepId, "failed", {}, fetched.error);
    db.update(workflowRuns)
      .set({ status: "failed", updatedAt: Date.now() })
      .where(eq(workflowRuns.id, input.runId))
      .run();
    return { error: fetched.error, status: fetched.httpStatus };
  }

  finishStep(intentStepId, "succeeded", fetched.intent);

  const decisionStepId = startStep("decide_and_reply", { intent: fetched.intent });

  const futureAppointments = db
    .select({
      doctorId: appointmentStubs.doctorId,
      startsAt: appointmentStubs.startsAt,
      endsAt: appointmentStubs.endsAt,
    })
    .from(appointmentStubs)
    .where(gte(appointmentStubs.endsAt, Date.now()))
    .all();

  const decision = computeSchedulingDecision(
    {
      doctors,
      intent: fetched.intent,
      latestUserMessage: input.latestUserMessage,
      futureAppointments,
    },
    (book) => {
      db.insert(appointmentStubs)
        .values({
          id: randomUUID(),
          runId: input.runId,
          doctorId: book.doctorId,
          startsAt: book.startsAt,
          endsAt: book.endsAt,
          patientNote: book.patientNote,
          createdAt: Date.now(),
        })
        .run();
    },
  );

  finishStep(decisionStepId, "succeeded", {
    outcome: decision.outcome,
    confidence: Number(decision.decisionConfidence.toFixed(2)),
    reply: decision.reply,
  });

  const runRow = db.select().from(workflowRuns).where(eq(workflowRuns.id, input.runId)).get();
  const baseMeta = runRow ? parseRunMetadata(runRow.metadataJson) : {};
  db.update(workflowRuns)
    .set({
      status: "completed",
      updatedAt: Date.now(),
      metadataJson: JSON.stringify({
        ...baseMeta,
        threadId: input.threadId,
        userMessageCount: input.userMessageCount,
        outcome: decision.outcome,
        latestUserMessage: input.latestUserMessage,
      }),
    })
    .where(eq(workflowRuns.id, input.runId))
    .run();

  return { message: decision.reply };
}
