import { INTENT_EXTRACTION_RULE_LINES } from "@/lib/workflow/chat-scheduling/intent-prompt-template";

import { runIntentParseBacktests } from "./intent-scenarios";
import { runSchedulingBacktests } from "./scheduling-scenarios";
import type { BacktestRunSummary } from "./types";

export function runAllBacktests(): BacktestRunSummary {
  const scheduling = runSchedulingBacktests();
  const intent = runIntentParseBacktests();
  const cases = [...scheduling, ...intent];
  const passed = cases.filter((c) => c.passed).length;

  return {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    passed,
    failed: cases.length - passed,
    promptRuleCount: INTENT_EXTRACTION_RULE_LINES.length,
    cases,
  };
}