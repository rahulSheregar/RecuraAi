import { randomUUID } from "node:crypto";

import { eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/sqlite";
import { workflowRuns, workflowStepRuns, emailTemplate } from "@/lib/db/schema";
import {
  DEFAULT_CHAT_MODEL,
  executeChatSchedulingWorkflow,
  parseRunMetadata,
  buildIntentPrompt,
  fetchIntentFromOpenAI,
  isoToday,
  type ChatMessage,
} from "@/lib/workflow/chat-scheduling";
import { listDoctorProfiles } from "@/lib/db/doctors";
import { sendEmail } from "@/lib/email-service/email-service";

export async function POST(request: Request) {
  const db = getDb();
  let runId: string | null = null;

  try {
    const body = (await request.json()) as {
      messages?: unknown;
      apiKey?: unknown;
      schedulingPromptTemplate?: unknown;
      threadId?: unknown;
      existingRunId?: unknown;
      templateId?: unknown;
    };

    const apiKeyFromClient =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const envKey = process.env.OPENAI_API_KEY?.trim() || "";
    const key = envKey || apiKeyFromClient;

    if (!key) {
      return NextResponse.json(
        {
          error:
            "No OpenAI API key available. Set OPENAI_API_KEY in .env.local on the server, or paste a key in Settings (kept in memory for this session only).",
        },
        { status: 400 },
      );
    }

    const rawMessages = body.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { error: "Request must include a non-empty messages array." },
        { status: 400 },
      );
    }

    const chatHistory: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      chatHistory.push({ role, content: content.trim() });
    }

    if (chatHistory.length === 0) {
      return NextResponse.json(
        { error: "No valid user or assistant messages." },
        { status: 400 },
      );
    }

    const latestUserMessage = [...chatHistory].reverse().find((m) => m.role === "user");
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: "No user message in request." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const existingRunId =
      typeof body.existingRunId === "string" && body.existingRunId.trim()
        ? body.existingRunId.trim()
        : null;

    let threadId =
      typeof body.threadId === "string" && body.threadId.trim()
        ? body.threadId.trim()
        : randomUUID();
    const userMessageCount = chatHistory.filter((m) => m.role === "user").length;
    let initialStepOrder = 0;

    if (existingRunId) {
      const existing = db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, existingRunId))
        .get();
      if (!existing) {
        return NextResponse.json({ error: "Workflow run not found." }, { status: 404 });
      }
      if (existing.source !== "voice") {
        return NextResponse.json(
          { error: "This run cannot be continued from chat." },
          { status: 400 },
        );
      }
      if (existing.status !== "running") {
        return NextResponse.json(
          { error: "Workflow run is not active." },
          { status: 400 },
        );
      }
      runId = existingRunId;
      const prevMeta = parseRunMetadata(existing.metadataJson);
      if (typeof prevMeta.threadId === "string" && prevMeta.threadId.trim()) {
        threadId = prevMeta.threadId.trim();
      }
      const maxRow = db
        .select({ maxIdx: max(workflowStepRuns.orderIndex) })
        .from(workflowStepRuns)
        .where(eq(workflowStepRuns.runId, existingRunId))
        .get();
      initialStepOrder = (maxRow?.maxIdx ?? -1) + 1;
    } else {
      runId = randomUUID();
      db.insert(workflowRuns)
        .values({
          id: runId,
          source: "chat",
          status: "running",
          createdAt: now,
          updatedAt: now,
          metadataJson: JSON.stringify({
            threadId,
            userMessageCount,
            latestUserMessage: latestUserMessage.content,
          }),
        })
        .run();
    }

    

    // Before running the full workflow, run a quick intent extraction so we can
    // notify via email if the intent is negative (out_of_scope) using the provided template.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const openaiModel = process.env.OPENAI_MODEL?.trim() || DEFAULT_CHAT_MODEL;
    const schedulingPromptTemplate =
      typeof body.schedulingPromptTemplate === "string"
        ? body.schedulingPromptTemplate
        : null;
    const templateId =
      typeof body.templateId === "string" && body.templateId.trim()
        ? body.templateId.trim()
        : null;

    try {
      const doctors = listDoctorProfiles();
      const extractionPrompt = buildIntentPrompt(
        isoToday(),
        timezone,
        doctors,
        schedulingPromptTemplate,
      );
      const chatHistoryTail = chatHistory
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const fetched = await fetchIntentFromOpenAI({
        openaiKey: key,
        model: openaiModel,
        extractionPrompt,
        chatHistoryTail,
      });
      if (fetched.ok) {
        const intent = fetched.intent;
        if (intent.scope === "out_of_scope" && templateId) {
          try {
            const tmpl = db.select().from(emailTemplate).where(eq(emailTemplate.id, templateId)).get();
            if (tmpl) {
              sendEmail(tmpl.subject, tmpl.content, {
                runId,
                templateId,
                reason: "intent_out_of_scope",
              });
            }
          } catch {
            // ignore email/template lookup errors
          }
        }
      }
    } catch {
      // ignore extraction errors here; executor will still run
    }

    const result = await executeChatSchedulingWorkflow({
      db,
      runId,
      initialStepOrder,
      threadId,
      userMessageCount,
      chatHistory,
      latestUserMessage: latestUserMessage.content,
      openaiKey: key,
      openaiModel,
      schedulingPromptTemplate,
      templateId,
      timezone,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: result.message });
  } catch (e) {
    if (runId) {
      db.update(workflowRuns)
        .set({
          status: "failed",
          updatedAt: Date.now(),
        })
        .where(eq(workflowRuns.id, runId))
        .run();
    }
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
