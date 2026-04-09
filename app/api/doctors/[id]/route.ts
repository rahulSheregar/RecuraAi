import { NextResponse } from "next/server";

import { deleteDoctorProfile } from "@/lib/db/doctors";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    deleteDoctorProfile(decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete doctor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
