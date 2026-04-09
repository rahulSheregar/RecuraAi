import { BacktestPanel } from "@/components/backtest-panel";
import { HomeScreenDock } from "@/components/home-screen-dock";

export default function BacktestPage() {
  return (
    <div className="home-dotted-bg flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-20 pb-40 sm:pb-44">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Backtesting</h1>
          <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
            Regression suite for the scheduling executor and intent normalization. Scenarios use fixed
            clocks and sample doctor fixtures so results are stable in CI and on any machine. Use
            failures to tighten prompts in Settings or adjust rules in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">lib/workflow/chat-scheduling/</code>.
          </p>
        </header>
        <BacktestPanel />
      </main>
      <HomeScreenDock />
    </div>
  );
}
