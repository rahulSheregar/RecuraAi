import { randomUUID } from "node:crypto";

import { eq, gte } from "drizzle-orm";

import { listDoctorProfiles } from "@/lib/db/doctors";
import { appointmentStubs, workflowRuns, workflowStepRuns } from "@/lib/db/schema";

import { buildIntentPrompt, fetchIntentFromOpenAI, isoToday } from "./intent";
import { parseRunMetadata } from "./metadata";
import { computeSchedulingDecision } from "./scheduling";
import type { ChatExecutorErr, ChatExecutorInput, ChatExecutorOk } from "./types";

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
