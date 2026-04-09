import { randomUUID } from "node:crypto";

import { eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

import { listDoctorProfiles } from "@/lib/db/doctors";
import { getDb } from "@/lib/db/sqlite";
import { appointmentStubs, workflowRuns, workflowStepRuns } from "@/lib/db/schema";
import type { DayKey, DoctorProfile } from "@/lib/doctor-profiles";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type IntentExtraction = {
  scope: "in_scope" | "out_of_scope" | "unclear";
  intent: "book" | "reschedule" | "cancel" | "question" | "other";
  doctorName: string | null;
  requestedDate: string | null;
  requestedTime24h: string | null;
  requestedStartIso: string | null;
  notes: string | null;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const SLOT_MINUTES = 30;

function safeJsonParse<T>(text: string): T | null {
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

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function toDayKey(date: Date): DayKey {
  const d = date.getDay();
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d] ?? "mon") as DayKey;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatSlot(start: Date, doctorName: string): string {
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time} with ${doctorName}`;
}

function normalizeIntent(raw: unknown): IntentExtraction {
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
    doctorName: typeof o.doctorName === "string" && o.doctorName.trim() ? o.doctorName.trim() : null,
    requestedDate:
      typeof o.requestedDate === "string" && o.requestedDate.trim() ? o.requestedDate.trim() : null,
    requestedTime24h:
      typeof o.requestedTime24h === "string" && o.requestedTime24h.trim() ? o.requestedTime24h.trim() : null,
    requestedStartIso:
      typeof o.requestedStartIso === "string" && o.requestedStartIso.trim() ? o.requestedStartIso.trim() : null,
    notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
  };
}

function findDoctorsByName(doctors: DoctorProfile[], name: string): DoctorProfile[] {
  const needle = name.trim().toLowerCase();
  if (!needle) return doctors;
  const exact = doctors.filter((d) => d.name.trim().toLowerCase() === needle);
  if (exact.length > 0) return exact;
  return doctors.filter((d) => d.name.toLowerCase().includes(needle));
}

function isSlotOpenForDoctor(doctor: DoctorProfile, start: Date, end: Date): boolean {
  const day = doctor.schedule.find((d) => d.day === toDayKey(start));
  if (!day || day.closed) return false;
  const startMins = start.getHours() * 60 + start.getMinutes();
  const endMins = end.getHours() * 60 + end.getMinutes();
  const openStart = parseTimeToMinutes(day.start);
  const openEnd = parseTimeToMinutes(day.end);
  if (openStart === null || openEnd === null) return false;
  return startMins >= openStart && endMins <= openEnd;
}

function hasConflict(
  appointments: { doctorId: string; startsAt: number; endsAt: number }[],
  doctorId: string,
  start: Date,
  end: Date,
): boolean {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return appointments.some(
    (a) =>
      a.doctorId === doctorId &&
      Math.max(startMs, a.startsAt) < Math.min(endMs, a.endsAt),
  );
}

function buildIntentPrompt(
  today: string,
  timezone: string,
  doctors: DoctorProfile[],
  customSystemPrompt: string,
): string {
  const doctorContext = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    expertise: d.expertise,
    schedule: d.schedule.map((s) => ({
      day: s.day,
      closed: s.closed,
      start: s.start,
      end: s.end,
    })),
  }));
  return [
    "You are an intent extractor for a dental clinic scheduler.",
    `Today's date: ${today}. Timezone: ${timezone}.`,
    "Use the doctor's live schedules below as your reference context.",
    "Return JSON only with this schema:",
    `{
  "scope": "in_scope" | "out_of_scope" | "unclear",
  "intent": "book" | "reschedule" | "cancel" | "question" | "other",
  "doctorName": string | null,
  "requestedDate": "YYYY-MM-DD" | null,
  "requestedTime24h": "HH:mm" | null,
  "requestedStartIso": ISO-8601 datetime | null,
  "notes": string | null
}`,
    "Rules:",
    "- Out of scope means non-dental medical requests; mark scope=out_of_scope.",
    "- If user asks to book, set intent=book even if date/time is incomplete.",
    "- Prefer explicit date/time from the user; do not invent impossible details.",
    "- Keep notes short and factual.",
    customSystemPrompt
      ? `Clinic style instructions: ${customSystemPrompt}`
      : "",
    `Doctor schedules context: ${JSON.stringify(doctorContext)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const db = getDb();
  let runId: string | null = null;
  let stepOrder = 0;

  const startStep = (stepKey: string, input: unknown) => {
    const id = randomUUID();
    db.insert(workflowStepRuns)
      .values({
        id,
        runId: runId ?? "",
        stepKey,
        status: "running",
        orderIndex: stepOrder++,
        startedAt: Date.now(),
        inputJson: JSON.stringify(input),
      })
      .run();
    return id;
  };

  const finishStep = (id: string, status: string, output: unknown, error?: string) => {
    db.update(workflowStepRuns)
      .set({
        status,
        finishedAt: Date.now(),
        outputJson: JSON.stringify(output),
        errorMessage: error ?? null,
      })
      .where(eq(workflowStepRuns.id, id))
      .run();
  };

  try {
    const body = (await request.json()) as {
      messages?: unknown;
      apiKey?: unknown;
      systemPrompt?: unknown;
    };

    const apiKeyFromClient =
      typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const envKey = process.env.OPENAI_API_KEY?.trim() || "";
    const key = envKey || apiKeyFromClient;

    if (!key) {
      return NextResponse.json(
        {
          error:
            "No OpenAI API key available. Set OPENAI_API_KEY in .env.local on the server, or paste a key in Settings (kept in memory for this session only).",
        },
        { status: 400 },
      );
    }

    const rawMessages = body.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { error: "Request must include a non-empty messages array." },
        { status: 400 },
      );
    }

    const chatHistory: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      chatHistory.push({ role, content: content.trim() });
    }

    if (chatHistory.length === 0) {
      return NextResponse.json(
        { error: "No valid user or assistant messages." },
        { status: 400 },
      );
    }

    const latestUserMessage = [...chatHistory].reverse().find((m) => m.role === "user");
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: "No user message in request." },
        { status: 400 },
      );
    }

    const now = Date.now();
    runId = randomUUID();
    db.insert(workflowRuns)
      .values({
        id: runId,
        source: "chat",
        status: "running",
        createdAt: now,
        updatedAt: now,
        metadataJson: JSON.stringify({ latestUserMessage: latestUserMessage.content }),
      })
      .run();

    const doctors = listDoctorProfiles();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const today = isoToday();

    const intentStepId = startStep("extract_intent", {
      today,
      timezone,
      latestUserMessage: latestUserMessage.content,
      doctorCount: doctors.length,
    });

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const extractionPrompt = buildIntentPrompt(
      today,
      timezone,
      doctors,
      typeof body.systemPrompt === "string" ? body.systemPrompt.trim() : "",
    );

    const extractionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: extractionPrompt },
          ...chatHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
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
      finishStep(intentStepId, "failed", {}, msg);
      db.update(workflowRuns)
        .set({ status: "failed", updatedAt: Date.now() })
        .where(eq(workflowRuns.id, runId))
        .run();
      return NextResponse.json({ error: msg }, { status: extractionRes.status === 401 ? 401 : 502 });
    }

    const rawIntent = extractionData.choices?.[0]?.message?.content?.trim() ?? "";
    const intent = normalizeIntent(safeJsonParse<IntentExtraction>(rawIntent));
    finishStep(intentStepId, "succeeded", intent);

    const decisionStepId = startStep("decide_and_reply", { intent });
    const futureAppointments = db
      .select({
        doctorId: appointmentStubs.doctorId,
        startsAt: appointmentStubs.startsAt,
        endsAt: appointmentStubs.endsAt,
      })
      .from(appointmentStubs)
      .where(gte(appointmentStubs.endsAt, Date.now()))
      .all();

    let reply = "";
    let outcome = "replied";

    if (intent.scope === "out_of_scope") {
      reply =
        "I can only help with dental appointment scheduling and related dental questions. If this is urgent or non-dental, please contact the appropriate clinician.";
      outcome = "declined_off_topic";
    } else if (doctors.length === 0) {
      reply =
        "I can help schedule, but there are no doctor profiles set up yet. Please add doctors in Profiles first.";
      outcome = "no_doctors_configured";
    } else if (intent.intent !== "book" && intent.intent !== "reschedule") {
      reply =
        "I can help book dental appointments. Please share your preferred doctor, date, and time (for example: Dr. Alex Kim next Monday at 10:30 AM).";
      outcome = "needs_scheduling_details";
    } else {
      const candidateDoctors = intent.doctorName
        ? findDoctorsByName(doctors, intent.doctorName)
        : doctors;

      if (candidateDoctors.length === 0) {
        const names = doctors.map((d) => d.name).join(", ");
        reply = `I could not find that doctor. Available doctors are: ${names}. Which one should I book with?`;
        outcome = "doctor_not_found";
      } else {
        let requestedStart: Date | null = null;
        if (intent.requestedStartIso) {
          const d = new Date(intent.requestedStartIso);
          if (!Number.isNaN(d.getTime())) requestedStart = d;
        } else if (intent.requestedDate && intent.requestedTime24h) {
          const d = new Date(`${intent.requestedDate}T${intent.requestedTime24h}:00`);
          if (!Number.isNaN(d.getTime())) requestedStart = d;
        }

        const slotEnd = requestedStart ? addMinutes(requestedStart, SLOT_MINUTES) : null;
        let booked = false;

        if (requestedStart && slotEnd) {
          for (const doctor of candidateDoctors) {
            if (
              isSlotOpenForDoctor(doctor, requestedStart, slotEnd) &&
              !hasConflict(futureAppointments, doctor.id, requestedStart, slotEnd)
            ) {
              db.insert(appointmentStubs)
                .values({
                  id: randomUUID(),
                  runId,
                  doctorId: doctor.id,
                  startsAt: requestedStart.getTime(),
                  endsAt: slotEnd.getTime(),
                  patientNote: latestUserMessage.content,
                  createdAt: Date.now(),
                })
                .run();
              reply = `Booked. Your appointment is scheduled for ${formatSlot(requestedStart, doctor.name)}.`;
              outcome = "booked";
              booked = true;
              break;
            }
          }
        }

        if (!booked) {
          const alternatives: { doctor: DoctorProfile; start: Date }[] = [];
          const nowDate = new Date();
          const horizonDays = 21;
          for (let i = 0; i <= horizonDays && alternatives.length < 4; i++) {
            const day = new Date(nowDate);
            day.setDate(nowDate.getDate() + i);
            day.setHours(0, 0, 0, 0);
            for (const doctor of candidateDoctors) {
              const daySchedule = doctor.schedule.find((s) => s.day === toDayKey(day));
              if (!daySchedule || daySchedule.closed) continue;
              const openStart = parseTimeToMinutes(daySchedule.start);
              const openEnd = parseTimeToMinutes(daySchedule.end);
              if (openStart === null || openEnd === null || openEnd - openStart < SLOT_MINUTES) {
                continue;
              }
              for (let mins = openStart; mins + SLOT_MINUTES <= openEnd; mins += SLOT_MINUTES) {
                const slotStart = new Date(day);
                slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
                const slotEndCandidate = addMinutes(slotStart, SLOT_MINUTES);
                if (slotStart.getTime() < Date.now()) continue;
                if (hasConflict(futureAppointments, doctor.id, slotStart, slotEndCandidate)) continue;
                alternatives.push({ doctor, start: slotStart });
                break;
              }
              if (alternatives.length >= 4) break;
            }
          }
          if (alternatives.length > 0) {
            const lines = alternatives
              .slice(0, 3)
              .map((a, idx) => `${idx + 1}. ${formatSlot(a.start, a.doctor.name)}`)
              .join("\n");
            reply = `That specific slot is not available. Here are the next available options:\n${lines}\n\nReply with the option number you'd like.`;
            outcome = "offered_alternatives";
          } else {
            reply =
              "I could not find an open slot in the next few weeks for that request. Please share another date range or preferred doctor.";
            outcome = "no_availability";
          }
        }
      }
    }

    finishStep(decisionStepId, "succeeded", { outcome, reply });
    db.update(workflowRuns)
      .set({
        status: "completed",
        updatedAt: Date.now(),
        metadataJson: JSON.stringify({ outcome }),
      })
      .where(eq(workflowRuns.id, runId))
      .run();

    return NextResponse.json({ message: reply });
  } catch (e) {
    if (runId) {
      db.update(workflowRuns)
        .set({ status: "failed", updatedAt: Date.now() })
        .where(eq(workflowRuns.id, runId))
        .run();
    }
    const message = e instanceof Error ? e.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
