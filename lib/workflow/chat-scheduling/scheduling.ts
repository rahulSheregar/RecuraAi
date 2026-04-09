import type { DoctorProfile } from "@/lib/doctor-profiles";

import { toDayKey } from "./intent";
import type { FutureAppointmentStub, IntentExtraction } from "./types";

export const SLOT_MINUTES = 30;

const DUMMY_FIRST_NAMES = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Avery",
  "Morgan",
];
const DUMMY_LAST_NAMES = [
  "Parker",
  "Reed",
  "Shaw",
  "Brooks",
  "Hayes",
  "Quinn",
  "Cole",
  "Rivera",
];

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatSlot(start: Date, doctorName: string): string {
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
  appointments: FutureAppointmentStub[],
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

function randomPatientName(): string {
  const first = DUMMY_FIRST_NAMES[Math.floor(Math.random() * DUMMY_FIRST_NAMES.length)];
  const last = DUMMY_LAST_NAMES[Math.floor(Math.random() * DUMMY_LAST_NAMES.length)];
  return `${first} ${last}`;
}

export type SchedulingDecision = {
  reply: string;
  outcome: string;
  decisionConfidence: number;
};

/**
 * Pure scheduling policy: given extracted intent and clinic state, produce assistant reply and outcome label.
 * Persisting bookings is done via `onBook` when a slot is confirmed.
 */
export function computeSchedulingDecision(
  input: {
    doctors: DoctorProfile[];
    intent: IntentExtraction;
    latestUserMessage: string;
    futureAppointments: FutureAppointmentStub[];
    /** Wall-clock anchor for tests and simulations (defaults to runtime `Date`). */
    asOf?: Date;
  },
  onBook: (args: {
    doctorId: string;
    startsAt: number;
    endsAt: number;
    patientNote: string;
  }) => void,
): SchedulingDecision {
  const { doctors, intent, latestUserMessage, futureAppointments } = input;
  const asOf = input.asOf ?? new Date();
  const asOfMs = asOf.getTime();
  const startOfAsOfDay = new Date(asOf);
  startOfAsOfDay.setHours(0, 0, 0, 0);

  let reply = "";
  let outcome = "replied";
  let decisionConfidence =
    intent.confidence !== null ? Math.max(0.2, Math.min(0.95, intent.confidence)) : 0.6;

  if (intent.scope === "out_of_scope") {
    reply =
      "I can only help with dental appointment scheduling and related dental questions. If this is urgent or non-dental, please contact the appropriate clinician.";
    outcome = "declined_off_topic";
    decisionConfidence = Math.max(decisionConfidence, 0.85);
  } else if (doctors.length === 0) {
    reply =
      "I can help schedule, but there are no doctor profiles set up yet. Please add doctors in Profiles first.";
    outcome = "no_doctors_configured";
    decisionConfidence = Math.max(decisionConfidence, 0.95);
  } else if (intent.intent !== "book" && intent.intent !== "reschedule") {
    reply =
      "I can help book dental appointments. Please share your preferred doctor, date, and time (for example: Dr. Alex Kim next Monday at 10:30 AM).";
    outcome = "needs_scheduling_details";
    decisionConfidence = Math.max(decisionConfidence, 0.75);
  } else {
    const candidateDoctors = intent.doctorName
      ? findDoctorsByName(doctors, intent.doctorName)
      : doctors;

    if (candidateDoctors.length === 0) {
      const names = doctors.map((d) => d.name).join(", ");
      reply = `I could not find that doctor. Available doctors are: ${names}. Which one should I book with?`;
      outcome = "doctor_not_found";
      decisionConfidence = Math.max(decisionConfidence, 0.85);
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
      /** True only when we parsed a real instant — invalid ISO/date parts are treated as open-ended search. */
      const userAskedConcreteSlot = requestedStart !== null;

      if (requestedStart && slotEnd) {
        for (const doctor of candidateDoctors) {
          if (
            isSlotOpenForDoctor(doctor, requestedStart, slotEnd) &&
            !hasConflict(futureAppointments, doctor.id, requestedStart, slotEnd)
          ) {
            const patientName = randomPatientName();
            onBook({
              doctorId: doctor.id,
              startsAt: requestedStart.getTime(),
              endsAt: slotEnd.getTime(),
              patientNote: JSON.stringify({
                patientName,
                source: "chat",
                request: latestUserMessage,
              }),
            });
            reply = `Booked. ${patientName} is scheduled for ${formatSlot(requestedStart, doctor.name)}.`;
            outcome = "booked";
            decisionConfidence = Math.max(decisionConfidence, 0.9);
            booked = true;
            break;
          }
        }
      }

      if (!booked) {
        const alternatives: { doctor: DoctorProfile; start: Date }[] = [];
        const horizonDays = 21;
        for (let i = 0; i <= horizonDays && alternatives.length < 4; i++) {
          const day = new Date(startOfAsOfDay);
          day.setDate(startOfAsOfDay.getDate() + i);
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
                if (slotStart.getTime() < asOfMs) continue;
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
          const intro = userAskedConcreteSlot
            ? "That specific slot is not available. Here are the next available options:"
            : "Here are the next available options across our doctors:";
          reply = `${intro}\n${lines}\n\nReply with the option number you'd like.`;
          outcome = "offered_alternatives";
          decisionConfidence = Math.max(decisionConfidence, 0.8);
        } else {
          reply =
            "I could not find an open slot in the next few weeks for that request. Please share another date range or preferred doctor.";
          outcome = "no_availability";
          decisionConfidence = Math.max(decisionConfidence, 0.75);
        }
      }
    }
  }

  return { reply, outcome, decisionConfidence };
}
