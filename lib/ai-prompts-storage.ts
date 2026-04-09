export type AiPrompts = {
  chatSystem: string;
  audioPrompt: string;
  schedulingPromptTemplate: string;
};

export const PROMPTS_STORAGE_KEY = "recura-ai-prompts-v1";

export const defaultPrompts: AiPrompts = {
  chatSystem: "",
  audioPrompt: "",
  schedulingPromptTemplate: `You are an intent extractor for a dental clinic scheduler.
Today's date: {{today_date}}. Timezone: {{timezone}}.
Use the doctor's live schedules below as your reference context.

Return JSON only with this schema:
{
  "scope": "in_scope" | "out_of_scope" | "unclear",
  "intent": "book" | "reschedule" | "cancel" | "question" | "other",
  "confidence": number (0..1),
  "doctorName": string | null,
  "requestedDate": "YYYY-MM-DD" | null,
  "requestedTime24h": "HH:mm" | null,
  "requestedStartIso": ISO-8601 datetime | null,
  "notes": string | null
}

Rules:
- Out of scope means non-dental medical requests; mark scope=out_of_scope.
- If user asks to book, set intent=book even if date/time is incomplete.
- Prefer explicit date/time from the user; do not invent impossible details.
- Keep notes short and factual.
- Always provide confidence between 0 and 1.
{{clinic_style_instructions}}

Doctor schedules context: {{doctor_info_json}}`,
};

export function loadPrompts(): AiPrompts {
  if (typeof window === "undefined") return defaultPrompts;
  try {
    const raw = localStorage.getItem(PROMPTS_STORAGE_KEY);
    if (!raw) return defaultPrompts;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultPrompts;
    const o = parsed as Record<string, unknown>;
    return {
      chatSystem: typeof o.chatSystem === "string" ? o.chatSystem : "",
      audioPrompt: typeof o.audioPrompt === "string" ? o.audioPrompt : "",
      schedulingPromptTemplate:
        typeof o.schedulingPromptTemplate === "string" && o.schedulingPromptTemplate.trim()
          ? o.schedulingPromptTemplate
          : defaultPrompts.schedulingPromptTemplate,
    };
  } catch {
    return defaultPrompts;
  }
}

export function savePrompts(prompts: AiPrompts) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
}
