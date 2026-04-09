import { NextResponse } from "next/server";

import { resetAppDatabase } from "@/lib/db/reset-app-data";

export function POST() {
  try {
    resetAppDatabase();
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
