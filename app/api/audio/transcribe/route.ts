import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/sqlite";
import { workflowRuns, workflowStepRuns } from "@/lib/db/schema";

const DEFAULT_AUDIO_MODEL = "whisper-1";

export async function POST(request: Request) {
  const db = getDb();
  let runId: string | null = null;
  let transcribeStepId: string | null = null;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const apiKeyRaw = form.get("apiKey");
    const threadIdRaw = form.get("threadId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
    }

    const apiKeyFromClient =
      typeof apiKeyRaw === "string" ? apiKeyRaw.trim() : "";
    const envKey = process.env.OPENAI_API_KEY?.trim() || "";
    const key = envKey || apiKeyFromClient;

    if (!key) {
      return NextResponse.json(
        {
          error:
            "No OpenAI API key available. Set OPENAI_API_KEY in .env.local on the server, or paste a key in Settings.",
        },
        { status: 400 },
      );
    }

    const threadId =
      typeof threadIdRaw === "string" && threadIdRaw.trim()
        ? threadIdRaw.trim()
        : randomUUID();
    const now = Date.now();
    runId = randomUUID();

    db.insert(workflowRuns)
      .values({
        id: runId,
        source: "voice",
        status: "running",
        createdAt: now,
        updatedAt: now,
        metadataJson: JSON.stringify({
          threadId,
          audioFileName: file.name,
          audioFileSize: file.size,
        }),
      })
      .run();

    db.insert(workflowStepRuns)
      .values({
        id: randomUUID(),
        runId,
        stepKey: "queued",
        status: "succeeded",
        orderIndex: 0,
        startedAt: now,
        finishedAt: now,
        inputJson: JSON.stringify({ fileName: file.name, fileSize: file.size }),
        outputJson: JSON.stringify({}),
      })
      .run();

    transcribeStepId = randomUUID();
    const transcribeStarted = Date.now();
    db.insert(workflowStepRuns)
      .values({
        id: transcribeStepId,
        runId,
        stepKey: "transcribe",
        status: "running",
        orderIndex: 1,
        startedAt: transcribeStarted,
        inputJson: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      })
      .run();

    const upstream = new FormData();
    upstream.append("file", file);
    upstream.append(
      "model",
      process.env.OPENAI_AUDIO_MODEL?.trim() || DEFAULT_AUDIO_MODEL,
    );

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: upstream,
    });

    const data = (await res.json()) as {
      text?: string;
      error?: { message?: string };
    };

    const failTranscribe = (message: string, status: number) => {
      if (transcribeStepId) {
        db.update(workflowStepRuns)
          .set({
            status: "failed",
            finishedAt: Date.now(),
            outputJson: JSON.stringify({}),
            errorMessage: message,
          })
          .where(eq(workflowStepRuns.id, transcribeStepId))
          .run();
      }
      if (runId) {
        db.update(workflowRuns)
          .set({ status: "failed", updatedAt: Date.now() })
          .where(eq(workflowRuns.id, runId))
          .run();
      }
      return NextResponse.json({ error: message }, { status });
    };

    if (!res.ok) {
      const message =
        data.error?.message ||
        `Audio transcription failed (${res.status}).`;
      return failTranscribe(message, res.status === 401 ? 401 : 502);
    }

    const transcript = data.text?.trim() || "";
    if (!transcript) {
      return failTranscribe("Transcription returned empty text.", 502);
    }

    db.update(workflowStepRuns)
      .set({
        status: "succeeded",
        finishedAt: Date.now(),
        outputJson: JSON.stringify({
          transcript,
          transcriptCharCount: transcript.length,
        }),
        errorMessage: null,
      })
      .where(eq(workflowStepRuns.id, transcribeStepId))
      .run();
    db.update(workflowRuns)
      .set({ updatedAt: Date.now() })
      .where(eq(workflowRuns.id, runId))
      .run();

    return NextResponse.json({ transcript, runId, threadId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    if (transcribeStepId) {
      db.update(workflowStepRuns)
        .set({
          status: "failed",
          finishedAt: Date.now(),
          errorMessage: message,
        })
        .where(eq(workflowStepRuns.id, transcribeStepId))
        .run();
    }
    if (runId) {
      db.update(workflowRuns)
        .set({ status: "failed", updatedAt: Date.now() })
        .where(eq(workflowRuns.id, runId))
        .run();
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}