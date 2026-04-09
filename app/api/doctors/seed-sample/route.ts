import { NextResponse } from "next/server";

import { listDoctorProfiles, seedSampleDoctorsToDb } from "@/lib/db/doctors";

export function POST() {
  try {
    const { count } = seedSampleDoctorsToDb();
    return NextResponse.json({
      ok: true,
      count,
      doctors: listDoctorProfiles(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to seed doctors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
