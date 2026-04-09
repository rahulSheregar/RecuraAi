import type { DoctorProfile } from "@/lib/doctor-profiles";
import { SAMPLE_DOCTOR_SCENARIOS } from "@/lib/sample-doctors-scenario";

export function cloneProfile(slug: string): DoctorProfile {
  const row = SAMPLE_DOCTOR_SCENARIOS.find((s) => s.slug === slug);
  if (!row) {
    throw new Error(`Unknown sample doctor slug: ${slug}`);
  }
  return {
    ...row.profile,
    schedule: row.profile.schedule.map((d) => ({ ...d })),
  };
}

/** Thursday 9 Apr 2026, 08:00 local — tests use the same calendar day for slot math. */
export const BACKTEST_AS_OF = new Date(2026, 3, 9, 8, 0, 0, 0);

export function localSlot(y: number, month: number, day: number, h: number, m: number): Date {
  return new Date(y, month - 1, day, h, m, 0, 0);
}
