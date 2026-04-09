import { desc } from "drizzle-orm";

import type { CalendarEvent } from "@/lib/calendar-event-types";

import { getDb } from "./sqlite";
import { appointmentStubs, doctorProfiles } from "./schema";

function parsePatientName(note: string | null): string {
  if (!note) return "Patient";
  try {
    const parsed = JSON.parse(note) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { patientName?: unknown }).patientName === "string"
    ) {
      const name = (parsed as { patientName: string }).patientName.trim();
      if (name) return name;
    }
  } catch {
    // Legacy rows may contain plain text notes.
  }
  return "Patient";
}

export function listCalendarEvents(): CalendarEvent[] {
  const db = getDb();
  const doctors = db.select().from(doctorProfiles).all();
  const doctorById = new Map(doctors.map((d) => [d.id, d.name]));

  const appointments = db
    .select()
    .from(appointmentStubs)
    .orderBy(desc(appointmentStubs.startsAt))
    .all();

  return appointments.map((row) => ({
    id: row.id,
    doctorId: row.doctorId,
    doctorName: doctorById.get(row.doctorId) ?? "Unknown doctor",
    patientName: parsePatientName(row.patientNote),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  }));
}
