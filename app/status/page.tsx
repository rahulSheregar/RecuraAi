import { HomeScreenDock } from "@/components/home-screen-dock";
import { StatusRunsView } from "@/components/status-runs-view";
import { listWorkflowRunStatus } from "@/lib/db/workflow-status";

export default function StatusPage() {
  const runs = listWorkflowRunStatus(50);

  return (
    <div className="home-dotted-bg flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-20 pb-40 sm:pb-44">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Workflow status</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Complete run history with step-by-step input, AI decisions, and confidence.
          </p>
        </header>
        <StatusRunsView runs={runs} />
      </main>
      <HomeScreenDock />
    </div>
  );
}
