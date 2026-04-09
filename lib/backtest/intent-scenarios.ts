import { normalizeIntent, safeJsonParse } from "@/lib/workflow/chat-scheduling/intent";
import type { IntentExtraction } from "@/lib/workflow/chat-scheduling/types";

import type { BacktestCaseResult } from "./types";

function partialMatch(actual: IntentExtraction, expect: Partial<IntentExtraction>): string[] {
  const failures: string[] = [];
  (Object.keys(expect) as (keyof IntentExtraction)[]).forEach((key) => {
    const ev = expect[key];
    if (ev === undefined) return;
    if (actual[key] !== ev) {
      failures.push(`${String(key)}: got ${JSON.stringify(actual[key])}, expected ${JSON.stringify(ev)}`);
    }
  });
  return failures;
}

type IntentScenario = {
  id: string;
  title: string;
  description: string;
  raw: unknown;
  expect: Partial<IntentExtraction>;
};

const INTENT_SCENARIOS: IntentScenario[] = [
  {
    id: "intent-empty-object",
    title: "Empty model output",
    description: "Missing fields normalize to safe defaults (unclear / other).",
    raw: {},
    expect: { scope: "unclear", intent: "other" },
  },
  {
    id: "intent-cancel-dental",
    title: "Cancel appointment",
    description: "Structured cancel intent is preserved.",
    raw: {
      scope: "in_scope",
      intent: "cancel",
      confidence: 0.88,
      doctorName: null,
      requestedDate: null,
      requestedTime24h: null,
      requestedStartIso: null,
      notes: "wants to cancel",
    },
    expect: { intent: "cancel", scope: "in_scope" },
  },
  {
    id: "intent-question",
    title: "Dental question",
    description: "Question intent preserved for non-booking Q&A.",
    raw: {
      scope: "in_scope",
      intent: "question",
      confidence: 0.7,
      doctorName: null,
      requestedDate: null,
      requestedTime24h: null,
      requestedStartIso: null,
      notes: null,
    },
    expect: { intent: "question" },
  },
  {
    id: "intent-confidence-clamp-high",
    title: "Confidence clamped high",
    description: "Values above 1 are clamped to 1.",
    raw: { scope: "in_scope", intent: "book", confidence: 2 },
    expect: { confidence: 1 },
  },
  {
    id: "intent-confidence-clamp-low",
    title: "Confidence clamped low",
    description: "Negative confidence clamps to 0.",
    raw: { scope: "in_scope", intent: "book", confidence: -0.5 },
    expect: { confidence: 0 },
  },
  {
    id: "intent-invalid-intent-string",
    title: "Unknown intent string",
    description: "Invalid intent falls back to other.",
    raw: { scope: "in_scope", intent: "schedule_me_maybe", confidence: 0.5 },
    expect: { intent: "other" },
  },
  {
    id: "intent-markdown-wrapped-json",
    title: "Markdown-wrapped JSON",
    description: "safeJsonParse extracts JSON from a fenced block.",
    raw: null,
    expect: { intent: "book", scope: "in_scope", doctorName: "Dr. Alex Kim" },
  },
];

export function runIntentParseBacktests(): BacktestCaseResult[] {
  const markdownBody =
    'Here is the result:\n```json\n{"scope":"in_scope","intent":"book","confidence":0.9,"doctorName":"Dr. Alex Kim","requestedDate":null,"requestedTime24h":null,"requestedStartIso":null,"notes":null}\n```';

  return INTENT_SCENARIOS.map((s) => {
    let raw: unknown = s.raw;
    if (s.id === "intent-markdown-wrapped-json") {
      raw = safeJsonParse<Record<string, unknown>>(markdownBody);
    }
    const actual = normalizeIntent(raw);
    const failures =
      s.id === "intent-markdown-wrapped-json" && raw === null
        ? ["safeJsonParse returned null for markdown fixture"]
        : partialMatch(actual, s.expect);

    return {
      id: s.id,
      category: "intent_parse",
      title: s.title,
      description: s.description,
      passed: failures.length === 0,
      failures,
      replyPreview: "",
      detailJson: JSON.stringify({ normalized: actual }, null, 2),
    };
  });
}
