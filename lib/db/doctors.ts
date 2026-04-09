import { eq } from "drizzle-orm";

import type { DoctorProfile } from "@/lib/doctor-profiles";
import { normalizeDoctorProfile } from "@/lib/doctor-profiles";
import { getSampleDoctorProfiles } from "@/lib/sample-doctors-scenario";

import { getDb } from "./sqlite";
import { doctorProfiles } from "./schema";

function rowToProfile(row: {
  id: string;
  name: string;
  expertise: string;
  scheduleJson: string;
}): DoctorProfile | null {
  try {
    const schedule = JSON.parse(row.scheduleJson) as unknown;
    return normalizeDoctorProfile({
      id: row.id,
      name: row.name,
      expertise: row.expertise,
      schedule,
    });
  } catch {
    return null;
  }
}

export function listDoctorProfiles(): DoctorProfile[] {
  const rows = getDb().select().from(doctorProfiles).all();
  return rows
    .map((row) => rowToProfile(row))
    .filter((p): p is DoctorProfile => p !== null);
}

export function replaceAllDoctorProfiles(profiles: DoctorProfile[]): void {
  const db = getDb();
  const now = Date.now();
  db.transaction((tx) => {
    tx.delete(doctorProfiles).run();
    if (profiles.length === 0) return;
    tx.insert(doctorProfiles)
      .values(
        profiles.map((p) => ({
          id: p.id,
          name: p.name,
          expertise: p.expertise,
          scheduleJson: JSON.stringify(p.schedule),
          updatedAt: now,
        })),
      )
      .run();
  });
}

export function upsertDoctorProfile(profile: DoctorProfile): void {
  const now = Date.now();
  getDb()
    .insert(doctorProfiles)
    .values({
      id: profile.id,
      name: profile.name,
      expertise: profile.expertise,
      scheduleJson: JSON.stringify(profile.schedule),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: doctorProfiles.id,
      set: {
        name: profile.name,
        expertise: profile.expertise,
        scheduleJson: JSON.stringify(profile.schedule),
        updatedAt: now,
      },
    })
    .run();
}

export function deleteDoctorProfile(id: string): void {
  getDb().delete(doctorProfiles).where(eq(doctorProfiles.id, id)).run();
}

/** Clears `doctor_profiles` and inserts the built-in edge-case scenario. */
export function seedSampleDoctorsToDb(): { count: number } {
  const profiles = getSampleDoctorProfiles();
  replaceAllDoctorProfiles(profiles);
  return { count: profiles.length };
}
