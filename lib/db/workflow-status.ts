import { desc, eq } from "drizzle-orm";

import { getDb } from "./sqlite";
import { workflowRuns, workflowStepRuns } from "./schema";

type JsonRecord = Record<string, unknown>;

export type WorkflowStepStatusView = {
  id: string;
  stepKey: string;
  status: string;
  orderIndex: number;
  startedAt: number | null;
  finishedAt: number | null;
  errorMessage: string | null;
  input: JsonRecord | null;
  output: JsonRecord | null;
};

export type WorkflowRunStatusView = {
  id: string;
  threadId: string;
  source: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  metadata: JsonRecord | null;
  steps: WorkflowStepStatusView[];
  currentStep: string | null;
};

export type WorkflowThreadStatusView = {
  threadId: string;
  latestUpdatedAt: number;
  runCount: number;
  runs: WorkflowRunStatusView[];
};

function safeParseObject(raw: string | null): JsonRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function listWorkflowRunStatus(limit = 80): WorkflowThreadStatusView[] {
  const db = getDb();
  const runs = db
    .select()
    .from(workflowRuns)
    .orderBy(desc(workflowRuns.createdAt))
    .limit(limit)
    .all();

  const normalizedRuns: WorkflowRunStatusView[] = runs.map((run) => {
    const metadata = safeParseObject(run.metadataJson);
    const threadId =
      typeof metadata?.threadId === "string" && metadata.threadId.trim()
        ? metadata.threadId
        : run.id;
    const steps = db
      .select()
      .from(workflowStepRuns)
      .where(eq(workflowStepRuns.runId, run.id))
      .orderBy(workflowStepRuns.orderIndex)
      .all()
      .map((s) => ({
        id: s.id,
        stepKey: s.stepKey,
        status: s.status,
        orderIndex: s.orderIndex,
        startedAt: s.startedAt ?? null,
        finishedAt: s.finishedAt ?? null,
        errorMessage: s.errorMessage ?? null,
        input: safeParseObject(s.inputJson),
        output: safeParseObject(s.outputJson),
      }));
    const running = steps.find((s) => s.status === "running");
    const latest = steps[steps.length - 1];

    return {
      id: run.id,
      threadId,
      source: run.source,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      metadata,
      steps,
      currentStep: running?.stepKey ?? latest?.stepKey ?? null,
    };
  });

  const byThread = new Map<string, WorkflowThreadStatusView>();
  for (const run of normalizedRuns) {
    const existing = byThread.get(run.threadId);
    if (!existing) {
      byThread.set(run.threadId, {
        threadId: run.threadId,
        latestUpdatedAt: run.updatedAt,
        runCount: 1,
        runs: [run],
      });
      continue;
    }
    existing.runs.push(run);
    existing.runCount += 1;
    existing.latestUpdatedAt = Math.max(existing.latestUpdatedAt, run.updatedAt);
  }

  return [...byThread.values()].sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
}
