export type BacktestCaseResult = {
  id: string;
  category: "scheduling" | "intent_parse";
  title: string;
  description: string;
  passed: boolean;
  failures: string[];
  actualOutcome?: string;
  expectedOutcome?: string;
  bookCalls?: number;
  expectedBookCalls?: number;
  replyPreview: string;
  /** Serialized fixture summary for the UI */
  detailJson?: string;
};

export type BacktestRunSummary = {
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  promptRuleCount: number;
  cases: BacktestCaseResult[];
};
