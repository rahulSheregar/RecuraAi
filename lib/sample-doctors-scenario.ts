import {
  defaultSchedule,
  type DayKey,
  type DaySchedule,
  type DoctorProfile,
} from "./doctor-profiles";

function patchSchedule(
  patches: Partial<
    Record<DayKey, Partial<Pick<DaySchedule, "closed" | "start" | "end">>>
  >,
): DaySchedule[] {
  return defaultSchedule().map((row) => ({
    ...row,
    ...(patches[row.day] ?? {}),
  }));
}

function allClosed(): DaySchedule[] {
  return defaultSchedule().map((row) => ({ ...row, closed: true }));
}

export type SampleDoctorScenario = {
  /** Stable id for tests and fixtures */
  id: string;
  /** Short label for scripts and UI */
  slug: string;
  /** What this row is meant to exercise */
  intent: string;
  profile: DoctorProfile;
};

/**
 * Deterministic doctor profiles for manual QA, fixtures, and automation.
 * Each entry documents an edge case (availability, copy, or identity).
 */
export const SAMPLE_DOCTOR_SCENARIOS: SampleDoctorScenario[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    slug: "baseline-weekdays",
    intent:
      "Typical Mon–Fri 9–5; use as default target when booking should succeed.",
    profile: {
      id: "11111111-1111-4111-8111-111111111101",
      name: "Dr. Alex Kim",
      expertise: "General and preventive dentistry",
      schedule: defaultSchedule(),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    slug: "no-availability",
    intent:
      "Every day closed; booking should fail or surface “no slots” / alternatives.",
    profile: {
      id: "11111111-1111-4111-8111-111111111102",
      name: "Dr. Pat Rivera",
      expertise: "Prosthodontics",
      schedule: allClosed(),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    slug: "micro-window-wednesday",
    intent:
      "Only Wednesday 11:00–11:30 open; tests narrow-slot and single-day logic.",
    profile: {
      id: "11111111-1111-4111-8111-111111111103",
      name: "Dr. Quinn Micro",
      expertise: "Endodontics",
      schedule: patchSchedule({
        mon: { closed: true },
        tue: { closed: true },
        wed: { closed: false, start: "11:00", end: "11:30" },
        thu: { closed: true },
        fri: { closed: true },
        sat: { closed: true },
        sun: { closed: true },
      }),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    slug: "evenings-only",
    intent:
      "Mon–Fri 18:00–20:00 only; tests off-hours requests vs calendar.",
    profile: {
      id: "11111111-1111-4111-8111-111111111104",
      name: "Dr. Eve Moon",
      expertise: "Cosmetic dentistry",
      schedule: patchSchedule({
        mon: { closed: false, start: "18:00", end: "20:00" },
        tue: { closed: false, start: "18:00", end: "20:00" },
        wed: { closed: false, start: "18:00", end: "20:00" },
        thu: { closed: false, start: "18:00", end: "20:00" },
        fri: { closed: false, start: "18:00", end: "20:00" },
        sat: { closed: true },
        sun: { closed: true },
      }),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    slug: "weekend-only",
    intent: "Saturday–Sunday hours only; weekday requests should miss this doctor.",
    profile: {
      id: "11111111-1111-4111-8111-111111111105",
      name: "Dr. Sam Weekend",
      expertise: "Pediatric dentistry",
      schedule: patchSchedule({
        mon: { closed: true },
        tue: { closed: true },
        wed: { closed: true },
        thu: { closed: true },
        fri: { closed: true },
        sat: { closed: false, start: "10:00", end: "14:00" },
        sun: { closed: false, start: "10:00", end: "14:00" },
      }),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    slug: "unicode-and-apostrophe",
    intent:
      "Non-ASCII and punctuation in name; UI and exports should preserve text.",
    profile: {
      id: "11111111-1111-4111-8111-111111111106",
      name: "Dr. 李明 O'Brien",
      expertise: "Oral surgery; TMJ (\"jaw\") disorders",
      schedule: defaultSchedule(),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    slug: "empty-expertise",
    intent: "Blank expertise; list/detail views should not break.",
    profile: {
      id: "11111111-1111-4111-8111-111111111107",
      name: "Dr. Casey Min",
      expertise: "",
      schedule: defaultSchedule(),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111108",
    slug: "long-expertise",
    intent: "Long multiline expertise string; truncation and layout.",
    profile: {
      id: "11111111-1111-4111-8111-111111111108",
      name: "Dr. Riley Verbose",
      expertise:
        "General dentistry; periodontics; implants; sedation (nitrous); " +
        "special interest in anxious patients and complex full-mouth rehab. " +
        "Languages: English, Spanish. Note: semicolons; \"quotes\"; and (parens) in text.",
      schedule: defaultSchedule(),
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111109",
    slug: "duplicate-display-name-a",
    intent:
      "Same display name as next row; tests disambiguation by id in booking/workflows.",
    profile: {
      id: "11111111-1111-4111-8111-111111111109",
      name: "Dr. Jordan Smith",
      expertise: "Orthodontics",
      schedule: patchSchedule({
        mon: { closed: false, start: "08:00", end: "12:00" },
        tue: { closed: false, start: "08:00", end: "12:00" },
        wed: { closed: true },
        thu: { closed: true },
        fri: { closed: true },
        sat: { closed: true },
        sun: { closed: true },
      }),
    },
  },
  {
    id: "11111111-1111-4111-8111-11111111110a",
    slug: "duplicate-display-name-b",
    intent: "Pair with duplicate-display-name-a; same name, different hours and id.",
    profile: {
      id: "11111111-1111-4111-8111-11111111110a",
      name: "Dr. Jordan Smith",
      expertise: "Oral hygiene / hygiene-only visits",
      schedule: patchSchedule({
        mon: { closed: true },
        tue: { closed: true },
        wed: { closed: false, start: "13:00", end: "17:00" },
        thu: { closed: false, start: "13:00", end: "17:00" },
        fri: { closed: false, start: "13:00", end: "17:00" },
        sat: { closed: true },
        sun: { closed: true },
      }),
    },
  },
  {
    id: "11111111-1111-4111-8111-11111111110b",
    slug: "early-morning-block",
    intent: "Mon–Fri 06:00–08:00; tests “early slot” vs business-hour assumptions.",
    profile: {
      id: "11111111-1111-4111-8111-11111111110b",
      name: "Dr. Morgan Dawn",
      expertise: "Family dentistry",
      schedule: patchSchedule({
        mon: { closed: false, start: "06:00", end: "08:00" },
        tue: { closed: false, start: "06:00", end: "08:00" },
        wed: { closed: false, start: "06:00", end: "08:00" },
        thu: { closed: false, start: "06:00", end: "08:00" },
        fri: { closed: false, start: "06:00", end: "08:00" },
        sat: { closed: true },
        sun: { closed: true },
      }),
    },
  },
];

/** Profiles only, in scenario order (for localStorage and fixtures). */
export function getSampleDoctorProfiles(): DoctorProfile[] {
  return SAMPLE_DOCTOR_SCENARIOS.map((s) => ({
    ...s.profile,
    schedule: s.profile.schedule.map((row) => ({ ...row })),
  }));
}
