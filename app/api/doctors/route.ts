import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { normalizeDoctorProfile } from "@/lib/doctor-profiles";
import {
  listDoctorProfiles,
  upsertDoctorProfile,
} from "@/lib/db/doctors";

export function GET() {
  try {
    return NextResponse.json(listDoctorProfiles());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load doctors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as unknown;
    const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const parsed = normalizeDoctorProfile(
      o ? { ...o, id: typeof o.id === "string" ? o.id : "" } : null,
    );
    if (!parsed || !parsed.name.trim()) {
      return NextResponse.json(
        { error: "Invalid doctor profile (name required)" },
        { status: 400 },
      );
    }
    const id = parsed.id.trim() || randomUUID();
    const profile = { ...parsed, id };
    upsertDoctorProfile(profile);
    return NextResponse.json(profile);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save doctor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
