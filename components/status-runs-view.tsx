import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorkflowRunStatusView } from "@/lib/db/workflow-status";

function formatTs(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function prettyJson(value: unknown): string {
  if (!value) return "—";
  return JSON.stringify(value, null, 2);
}

function confidenceLabel(output: Record<string, unknown> | null): string | null {
  if (!output) return null;
  const raw = output.confidence;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return `${Math.round(raw * 100)}%`;
}

export function StatusRunsView({ runs }: { runs: WorkflowRunStatusView[] }) {
  if (runs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No workflow runs yet</CardTitle>
          <CardDescription>
            Send chat messages to trigger scheduling workflows. History will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {runs.map((run) => (
        <Card key={run.id}>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">
              Run {run.id.slice(0, 8)} ·{" "}
              <span className="text-muted-foreground font-normal">{run.source}</span>
            </CardTitle>
            <CardDescription>
              Status: <span className="font-medium text-foreground">{run.status}</span> ·
              Started: {formatTs(run.createdAt)} · Updated: {formatTs(run.updatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Run metadata
              </p>
              <pre className="mt-1 overflow-auto rounded-md border border-border bg-muted/20 p-2 text-xs">
                {prettyJson(run.metadata)}
              </pre>
            </div>
            <div className="space-y-3">
              {run.steps.map((step) => (
                <div key={step.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {step.orderIndex + 1}. {step.stepKey}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-2 py-1">{step.status}</span>
                      {confidenceLabel(step.output) ? (
                        <span className="rounded bg-primary/10 px-2 py-1 text-primary">
                          confidence {confidenceLabel(step.output)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Started: {formatTs(step.startedAt)} · Finished: {formatTs(step.finishedAt)}
                  </p>
                  {step.errorMessage ? (
                    <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      {step.errorMessage}
                    </p>
                  ) : null}
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Input</p>
                      <pre className="mt-1 overflow-auto rounded-md border border-border bg-muted/20 p-2 text-xs">
                        {prettyJson(step.input)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Output / Decision</p>
                      <pre className="mt-1 overflow-auto rounded-md border border-border bg-muted/20 p-2 text-xs">
                        {prettyJson(step.output)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
