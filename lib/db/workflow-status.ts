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
  source: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  metadata: JsonRecord | null;
  steps: WorkflowStepStatusView[];
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

export function listWorkflowRunStatus(limit = 40): WorkflowRunStatusView[] {
  const db = getDb();
  const runs = db
    .select()
    .from(workflowRuns)
    .orderBy(desc(workflowRuns.createdAt))
    .limit(limit)
    .all();

  return runs.map((run) => {
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

    return {
      id: run.id,
      source: run.source,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      metadata: safeParseObject(run.metadataJson),
      steps,
    };
  });
}
