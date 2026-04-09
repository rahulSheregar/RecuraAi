export type DayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type DaySchedule = {
  day: DayKey;
  label: string;
  closed: boolean;
  /** 24h "HH:mm" */
  start: string;
  end: string;
};

export type DoctorProfile = {
  id: string;
  name: string;
  expertise: string;
  schedule: DaySchedule[];
};

export const DAY_ORDER: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export const STORAGE_KEY = "recura-doctor-profiles-v1";

export function defaultSchedule(): DaySchedule[] {
  return DAY_ORDER.map(({ key, label }) => ({
    day: key,
    label,
    closed: key === "sat" || key === "sun",
    start: "09:00",
    end: "17:00",
  }));
}

export function emptyProfile(): DoctorProfile {
  return {
    id: "",
    name: "",
    expertise: "",
    schedule: defaultSchedule(),
  };
}

export function formatScheduleSummary(schedule: DaySchedule[]): string {
  const open = schedule.filter((d) => !d.closed);
  if (open.length === 0) return "No working hours set";
  return open
    .map((d) => `${d.label.slice(0, 3)} ${d.start}–${d.end}`)
    .join(" · ");
}

function normalizeProfile(raw: unknown): DoctorProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const schedule = o.schedule;
  const validSchedule =
    Array.isArray(schedule) &&
    schedule.length === 7 &&
    schedule.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as DaySchedule).day === "string" &&
        typeof (s as DaySchedule).closed === "boolean",
    );
  return {
    id: o.id,
    name: o.name,
    expertise: typeof o.expertise === "string" ? o.expertise : "",
    schedule: validSchedule ? (schedule as DaySchedule[]) : defaultSchedule(),
  };
}

export function loadProfiles(): DoctorProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeProfile)
      .filter((p): p is DoctorProfile => p !== null);
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: DoctorProfile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}
