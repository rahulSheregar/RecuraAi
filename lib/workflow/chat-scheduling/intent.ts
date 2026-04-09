import type { DayKey } from "@/lib/doctor-profiles";

import type { IntentExtraction } from "./types";

export { buildIntentPrompt, INTENT_EXTRACTION_RULE_LINES } from "./intent-prompt-template";

export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    try {
      return JSON.parse(text.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
}

export function normalizeIntent(raw: unknown): IntentExtraction {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const scope =
    o.scope === "in_scope" || o.scope === "out_of_scope" || o.scope === "unclear"
      ? o.scope
      : "unclear";
  const intent =
    o.intent === "book" ||
    o.intent === "reschedule" ||
    o.intent === "cancel" ||
    o.intent === "question" ||
    o.intent === "other"
      ? o.intent
      : "other";
  return {
    scope,
    intent,
    confidence:
      typeof o.confidence === "number" && !Number.isNaN(o.confidence)
        ? Math.max(0, Math.min(1, o.confidence))
        : null,
    doctorName: typeof o.doctorName === "string" && o.doctorName.trim() ? o.doctorName.trim() : null,
    requestedDate:
      typeof o.requestedDate === "string" && o.requestedDate.trim() ? o.requestedDate.trim() : null,
    requestedTime24h:
      typeof o.requestedTime24h === "string" && o.requestedTime24h.trim()
        ? o.requestedTime24h.trim()
        : null,
    requestedStartIso:
      typeof o.requestedStartIso === "string" && o.requestedStartIso.trim()
        ? o.requestedStartIso.trim()
        : null,
    notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
  };
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function toDayKey(date: Date): DayKey {
  const d = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d] ?? "mon") as DayKey;
}

export type IntentFetchResult =
  | { ok: true; intent: IntentExtraction }
  | { ok: false; error: string; httpStatus: number };

export async function fetchIntentFromOpenAI(params: {
  openaiKey: string;
  model: string;
  extractionPrompt: string;
  chatHistoryTail: { role: "user" | "assistant"; content: string }[];
}): Promise<IntentFetchResult> {
  const extractionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.openaiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: params.extractionPrompt },
        ...params.chatHistoryTail.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const extractionData = (await extractionRes.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };

  if (!extractionRes.ok) {
    const msg =
      extractionData.error?.message ||
      `OpenAI request failed (${extractionRes.status}). Check your key and model.`;
    return {
      ok: false,
      error: msg,
      httpStatus: extractionRes.status === 401 ? 401 : 502,
    };
  }

  const rawIntent = extractionData.choices?.[0]?.message?.content?.trim() ?? "";
  const intent = normalizeIntent(safeJsonParse<IntentExtraction>(rawIntent));
  return { ok: true, intent };
}
