"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BacktestRunSummary } from "@/lib/backtest/types";
import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconCheck, IconRefresh, IconX } from "@tabler/icons-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

export function BacktestPanel() {
  const [data, setData] = React.useState<BacktestRunSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest", { cache: "no-store" });
      const json = (await res.json()) as BacktestRunSummary | { error?: string };
      if (!res.ok || "error" in json) {
        setError(
          typeof json === "object" && json && "error" in json && json.error
            ? String(json.error)
            : `Request failed (${res.status})`,
        );
        setData(null);
        return;
      }
      setData(json as BacktestRunSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {data ? (
            <p className="text-muted-foreground text-sm">
              Last run: {new Date(data.generatedAt).toLocaleString()} · Intent prompt rules in default
              template: <span className="text-foreground font-medium">{data.promptRuleCount}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Deterministic checks for scheduling policy and intent normalization (no live OpenAI calls).
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <IconRefresh className={cn("mr-2 size-4", loading && "animate-spin")} aria-hidden />
          Run again
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <IconAlertTriangle className="size-5" aria-hidden />
              Backtest runner error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {data ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>
              <span className="text-foreground font-semibold text-green-600 dark:text-green-400">
                {data.passed} passed
              </span>
              {" · "}
              <span
                className={cn(
                  "font-semibold",
                  data.failed > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {data.failed} failed
              </span>
              {" · "}
              {data.total} total
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading && !data ? (
        <p className="text-muted-foreground text-sm">Running backtests…</p>
      ) : null}

      <div className="space-y-2">
        {data?.cases.map((c) => (
          <details
            key={c.id}
            className={cn(
              "rounded-lg border p-3",
              c.passed ? "border-border bg-card/40" : "border-destructive/40 bg-destructive/5",
            )}
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {c.passed ? (
                    <IconCheck className="size-5 text-green-600 dark:text-green-400" aria-label="Passed" />
                  ) : (
                    <IconX className="text-destructive size-5" aria-label="Failed" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="text-muted-foreground mr-2 text-xs uppercase tracking-wide">
                      {c.category}
                    </span>
                    {c.title}
                  </p>
                  <p className="text-muted-foreground text-sm">{c.description}</p>
                  {c.actualOutcome ? (
                    <p className="mt-1 font-mono text-xs">
                      outcome: {c.actualOutcome}
                      {c.expectedOutcome && c.actualOutcome !== c.expectedOutcome
                        ? ` → expected ${c.expectedOutcome}`
                        : null}
                      {typeof c.bookCalls === "number" ? ` · bookings: ${c.bookCalls}` : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </summary>
            {c.replyPreview ? (
              <div className="mt-3 border-border border-t pt-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Reply preview
                </p>
                <pre className="max-h-40 overflow-auto rounded-md bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                  {c.replyPreview || "—"}
                </pre>
              </div>
            ) : null}
            {c.failures.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-sm text-destructive">
                {c.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
            {c.detailJson ? (
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/20 p-2 text-[11px] leading-snug">
                {c.detailJson}
              </pre>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}
