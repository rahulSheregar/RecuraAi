import { computeSchedulingDecision } from "@/lib/workflow/chat-scheduling/scheduling";
import type { FutureAppointmentStub, IntentExtraction } from "@/lib/workflow/chat-scheduling/types";

import { BACKTEST_AS_OF, cloneProfile, localSlot } from "./fixtures";
import type { BacktestCaseResult } from "./types";

function I(partial: Partial<IntentExtraction>): IntentExtraction {
  return {
    scope: "in_scope",
    intent: "book",
    confidence: 0.88,
    doctorName: null,
    requestedDate: null,
    requestedTime24h: null,
    requestedStartIso: null,
    notes: null,
    ...partial,
  };
}

type SchedScenario = {
  id: string;
  title: string;
  description: string;
  userMessage: string;
  intent: IntentExtraction;
  doctors: ReturnType<typeof cloneProfile>[];
  futureAppointments: FutureAppointmentStub[];
  asOf: Date;
  expectOutcome: string;
  expectBookCalls: number;
  replyMustInclude?: string[];
  replyMustNotInclude?: string[];
};

function buildScenarios(): SchedScenario[] {
  const alex = cloneProfile("baseline-weekdays");
  const patClosed = cloneProfile("no-availability");
  const eveEvening = cloneProfile("evenings-only");
  const weekend = cloneProfile("weekend-only");
  const unicode = cloneProfile("unicode-and-apostrophe");
  const jordanA = cloneProfile("duplicate-display-name-a");
  const jordanB = cloneProfile("duplicate-display-name-b");
  const dawn = cloneProfile("early-morning-block");

  const thuAfternoon = localSlot(2026, 4, 9, 15, 0);
  const thuAfternoonIso = thuAfternoon.toISOString();
  const overlapStart = thuAfternoon.getTime();
  const overlapEnd = overlapStart + 30 * 60 * 1000;

  return [
    {
      id: "sched-out-of-scope",
      title: "Non-dental medical request",
      description: "Out-of-scope trips decline branch before scheduling.",
      userMessage: "I need a prescription for blood pressure medication.",
      intent: I({ scope: "out_of_scope", intent: "other", confidence: 0.9 }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "declined_off_topic",
      expectBookCalls: 0,
      replyMustInclude: ["dental"],
    },
    {
      id: "sched-no-doctors",
      title: "Empty roster",
      description: "No profiles configured → explicit copy.",
      userMessage: "Book me tomorrow at 10.",
      intent: I({ intent: "book" }),
      doctors: [],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "no_doctors_configured",
      expectBookCalls: 0,
      replyMustInclude: ["doctor profiles"],
    },
    {
      id: "sched-intent-question",
      title: "Pure question",
      description: "question intent does not enter booking loop.",
      userMessage: "Do you take Delta Dental?",
      intent: I({ intent: "question", confidence: 0.8 }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "needs_scheduling_details",
      expectBookCalls: 0,
    },
    {
      id: "sched-intent-cancel",
      title: "Cancel flow",
      description: "cancel is not book/reschedule → scheduling nudge (MVP behavior).",
      userMessage: "Cancel my appointment next week.",
      intent: I({ intent: "cancel", confidence: 0.82 }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "needs_scheduling_details",
      expectBookCalls: 0,
      replyMustInclude: ["book"],
    },
    {
      id: "sched-doctor-not-found",
      title: "Unknown doctor name",
      description: "Fictional name matches nobody → roster list in reply.",
      userMessage: "Book with Dr. Who.",
      intent: I({ intent: "book", doctorName: "Dr. Who", confidence: 0.7 }),
      doctors: [alex, eveEvening],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "doctor_not_found",
      expectBookCalls: 0,
      replyMustInclude: ["Available doctors"],
    },
    {
      id: "sched-book-concrete-open-slot",
      title: "Concrete open slot",
      description: "Valid same-day slot on an open calendar books exactly once.",
      userMessage: "Thursday 3pm with Dr. Alex Kim please.",
      intent: I({
        intent: "book",
        doctorName: "Alex Kim",
        requestedStartIso: thuAfternoonIso,
        confidence: 0.92,
      }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "booked",
      expectBookCalls: 1,
      replyMustInclude: ["Booked."],
    },
    {
      id: "sched-book-slot-blocked",
      title: "Concrete slot conflicts",
      description: "Existing stub blocks requested window → alternatives.",
      userMessage: "Thursday 3pm with Dr. Alex Kim please.",
      intent: I({
        intent: "book",
        doctorName: "Alex Kim",
        requestedStartIso: thuAfternoonIso,
        confidence: 0.9,
      }),
      doctors: [alex],
      futureAppointments: [
        { doctorId: alex.id, startsAt: overlapStart, endsAt: overlapEnd },
      ],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
      replyMustInclude: ["next available options"],
    },
    {
      id: "sched-earliest-multi-doctor",
      title: "Earliest search across doctors",
      description: "No doctor filter + no concrete datetime → multi-doctor copy.",
      userMessage: "Earliest appointment possible with anyone.",
      intent: I({
        intent: "book",
        doctorName: null,
        requestedDate: null,
        requestedTime24h: null,
        requestedStartIso: null,
        confidence: 0.8,
      }),
      doctors: [alex, dawn],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
      replyMustInclude: ["across our doctors"],
      replyMustNotInclude: ["That specific slot is not available"],
    },
    {
      id: "sched-no-availability-all-closed",
      title: "Only fully-closed doctor",
      description: "No bookable window in horizon → no_availability.",
      userMessage: "Any slot this month.",
      intent: I({ intent: "book", doctorName: "Pat Rivera", confidence: 0.75 }),
      doctors: [patClosed],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "no_availability",
      expectBookCalls: 0,
    },
    {
      id: "sched-partial-name-match",
      title: "Partial doctor name",
      description: "Substring match resolves to Alex Kim.",
      userMessage: "Book with Kim.",
      intent: I({ intent: "book", doctorName: "Kim", confidence: 0.77 }),
      doctors: [alex, eveEvening],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
    },
    {
      id: "sched-unicode-name",
      title: "Unicode / apostrophe name",
      description: "Matcher finds 李明 O'Brien by substring.",
      userMessage: "I want O'Brien.",
      intent: I({ intent: "book", doctorName: "O'Brien", confidence: 0.8 }),
      doctors: [unicode, alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
    },
    {
      id: "sched-reschedule-like-book",
      title: "Reschedule with new time",
      description: "Reschedule + ISO datetime follows same booking path.",
      userMessage: "Move me to Thursday 3pm.",
      intent: I({
        intent: "reschedule",
        requestedStartIso: thuAfternoonIso,
        confidence: 0.85,
      }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "booked",
      expectBookCalls: 1,
    },
    {
      id: "sched-weekend-only-doctor",
      title: "Weekend-only coverage",
      description: "Weekend doctor contributes slots when in candidate set.",
      userMessage: "Soonest appointment with Sam Weekend.",
      intent: I({ intent: "book", doctorName: "Sam Weekend", confidence: 0.8 }),
      doctors: [weekend, patClosed],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
    },
    {
      id: "sched-duplicate-display-names",
      title: "Duplicate display names",
      description: "Two Jordan Smith rows: first exact-match in list gets first booking try.",
      userMessage: "Book Jordan Smith Monday morning.",
      intent: I({
        intent: "book",
        doctorName: "Dr. Jordan Smith",
        requestedDate: "2026-04-13",
        requestedTime24h: "09:00",
        confidence: 0.8,
      }),
      doctors: [jordanA, jordanB],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "booked",
      expectBookCalls: 1,
    },
    {
      id: "sched-invalid-iso-datetime",
      title: "Invalid ISO datetime",
      description: "Bad requestedStartIso is ignored; falls back to alternative search.",
      userMessage: "Book me whenever.",
      intent: I({
        intent: "book",
        requestedStartIso: "not-a-real-iso-date",
        confidence: 0.5,
      }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
      replyMustInclude: ["across our doctors"],
    },
    {
      id: "sched-date-without-time",
      title: "Date without time",
      description: "Only requestedDate set → no concrete instant; search alternatives.",
      userMessage: "Any time next Thursday.",
      intent: I({
        intent: "book",
        requestedDate: "2026-04-16",
        requestedTime24h: null,
        requestedStartIso: null,
        confidence: 0.7,
      }),
      doctors: [alex],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
    },
    {
      id: "sched-evening-hours-miss-morning-request",
      title: "Evening-only doctor + morning ask",
      description: "Concrete morning slot not in Eve's hours → alternatives or no match.",
      userMessage: "9am with Eve Moon.",
      intent: I({
        intent: "book",
        doctorName: "Eve Moon",
        requestedDate: "2026-04-10",
        requestedTime24h: "09:00",
        confidence: 0.85,
      }),
      doctors: [eveEvening],
      futureAppointments: [],
      asOf: BACKTEST_AS_OF,
      expectOutcome: "offered_alternatives",
      expectBookCalls: 0,
    },
  ];
}

export function runSchedulingBacktests(): BacktestCaseResult[] {
  return buildScenarios().map((s) => {
    let bookCalls = 0;
    const decision = computeSchedulingDecision(
      {
        doctors: s.doctors,
        intent: s.intent,
        latestUserMessage: s.userMessage,
        futureAppointments: s.futureAppointments,
        asOf: s.asOf,
      },
      () => {
        bookCalls += 1;
      },
    );

    const failures: string[] = [];
    if (decision.outcome !== s.expectOutcome) {
      failures.push(`outcome: got "${decision.outcome}", expected "${s.expectOutcome}"`);
    }
    if (bookCalls !== s.expectBookCalls) {
      failures.push(`onBook calls: got ${bookCalls}, expected ${s.expectBookCalls}`);
    }
    for (const frag of s.replyMustInclude ?? []) {
      if (!decision.reply.includes(frag)) {
        failures.push(`reply must include "${frag}"`);
      }
    }
    for (const frag of s.replyMustNotInclude ?? []) {
      if (decision.reply.includes(frag)) {
        failures.push(`reply must not include "${frag}"`);
      }
    }

    const replyPreview =
      decision.reply.length > 220 ? `${decision.reply.slice(0, 220)}…` : decision.reply;

    return {
      id: s.id,
      category: "scheduling",
      title: s.title,
      description: s.description,
      passed: failures.length === 0,
      failures,
      actualOutcome: decision.outcome,
      expectedOutcome: s.expectOutcome,
      bookCalls,
      expectedBookCalls: s.expectBookCalls,
      replyPreview,
      detailJson: JSON.stringify(
        {
          userMessage: s.userMessage,
          intent: s.intent,
          doctorNames: s.doctors.map((d) => d.name),
          appointmentBlocks: s.futureAppointments.length,
        },
        null,
        2,
      ),
    };
  });
}
