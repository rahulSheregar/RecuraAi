import type { getDb } from "@/lib/db/sqlite";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type IntentExtraction = {
  scope: "in_scope" | "out_of_scope" | "unclear";
  intent: "book" | "reschedule" | "cancel" | "question" | "other";
  confidence: number | null;
  doctorName: string | null;
  requestedDate: string | null;
  requestedTime24h: string | null;
  requestedStartIso: string | null;
  notes: string | null;
};

export type FutureAppointmentStub = {
  doctorId: string;
  startsAt: number;
  endsAt: number;
};

export type ChatExecutorInput = {
  db: ReturnType<typeof getDb>;
  runId: string;
  initialStepOrder: number;
  threadId: string;
  userMessageCount: number;
  chatHistory: ChatMessage[];
  latestUserMessage: string;
  openaiKey: string;
  openaiModel: string;
  schedulingPromptTemplate: string | null;
  timezone: string;
};

export type ChatExecutorOk = { message: string };

export type ChatExecutorErr = {
  error: string;
  status: number;
};
