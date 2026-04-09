import type { DoctorProfile } from "@/lib/doctor-profiles";

/**
 * Human-readable rules shipped to the model. Exported for the backtest UI and docs.
 * Keep these aligned with {@link buildIntentPrompt} behavior.
 */
export const INTENT_EXTRACTION_RULE_LINES: string[] = [
  "Out of scope means non-dental medical requests; mark scope=out_of_scope.",
  "If the user asks to book, set intent=book even if date/time is incomplete.",
  "If the user asks to cancel an appointment, set intent=cancel (scope in_scope when the request is clearly about dental appointments).",
  "If the user asks an informational dental question without asking to book, set intent=question.",
  "If the user wants to move or change an existing appointment time, set intent=reschedule and extract the new date/time when they state it.",
  "Prefer explicit date/time from the user; do not invent impossible details.",
  'doctorName: set only when the user explicitly names or chooses a doctor (e.g. "with Dr. Kim").',
  "For open-ended requests — earliest appointment, soonest, next available, any doctor, no preference — use doctorName=null so every doctor can be considered.",
  "For earliest/next-available style requests where the user did not state a specific clock time or date, leave requestedDate, requestedTime24h, and requestedStartIso null.",
  "Do not guess a datetime from the schedule list; null lets the app search the soonest real openings across doctors.",
  "Never copy example or roster names into doctorName unless the user actually said that name.",
  "Keep notes short and factual.",
  "Always provide confidence between 0 and 1.",
];

const INTENT_INTRO_LINES = [
  "You are an intent extractor for a dental clinic scheduler.",
  "Today's date: {{today_date}}. Timezone: {{timezone}}.",
  "Use the doctor's live schedules below as your reference context.",
];

const INTENT_JSON_SCHEMA_LINES = [
  "Return JSON only with this schema:",
  "{",
  '  "scope": "in_scope" | "out_of_scope" | "unclear",',
  '  "intent": "book" | "reschedule" | "cancel" | "question" | "other",',
  '  "confidence": number (0..1),',
  '  "doctorName": string | null,',
  '  "requestedDate": "YYYY-MM-DD" | null,',
  '  "requestedTime24h": "HH:mm" | null,',
  '  "requestedStartIso": ISO-8601 datetime | null,',
  '  "notes": string | null',
  "}",
];

function doctorContextJson(doctors: DoctorProfile[]): string {
  return JSON.stringify(
    doctors.map((d) => ({
      id: d.id,
      name: d.name,
      expertise: d.expertise,
      schedule: d.schedule.map((s) => ({
        day: s.day,
        closed: s.closed,
        start: s.start,
        end: s.end,
      })),
    })),
  );
}

/**
 * Builds the default system prompt for intent extraction. Custom templates from
 * settings replace this entire body when non-empty.
 */
export function buildIntentPrompt(
  today: string,
  timezone: string,
  doctors: DoctorProfile[],
  templateOverride: string | null,
): string {
  const defaultBody = [
    INTENT_INTRO_LINES.join("\n"),
    "",
    INTENT_JSON_SCHEMA_LINES.join("\n"),
    "",
    "Rules:",
    ...INTENT_EXTRACTION_RULE_LINES.map((line) =>
      line.startsWith("-") ? line : `- ${line}`,
    ),
    "{{clinic_style_instructions}}",
    "",
    "Doctor schedules context: {{doctor_info_json}}",
  ].join("\n");

  const template =
    typeof templateOverride === "string" && templateOverride.trim()
      ? templateOverride
      : defaultBody;

  return template
    .replaceAll("{{today_date}}", today)
    .replaceAll("{{timezone}}", timezone)
    .replaceAll("{{doctor_info_json}}", doctorContextJson(doctors))
    .replaceAll("{{clinic_style_instructions}}", "");
}
