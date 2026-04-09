import { NextResponse } from "next/server";

import { runAllBacktests } from "@/lib/backtest/run-all";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = runAllBacktests();
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backtest run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
