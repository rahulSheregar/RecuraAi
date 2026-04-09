import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** One execution of a workflow from trigger to completion. */
export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  /** e.g. voice | chat */
  source: text("source").notNull(),
  /** e.g. pending | running | completed | failed */
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  /** JSON: source refs, summary, etc. */
  metadataJson: text("metadata_json"),
});

export const workflowStepRuns = sqliteTable(
  "workflow_step_runs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    /** e.g. transcribe | triage | extract_intent | check_availability | reply */
    stepKey: text("step_key").notNull(),
    /** pending | running | succeeded | failed | skipped */
    status: text("status").notNull(),
    orderIndex: integer("order_index").notNull(),
    startedAt: integer("started_at", { mode: "number" }),
    finishedAt: integer("finished_at", { mode: "number" }),
    errorMessage: text("error_message"),
    inputJson: text("input_json"),
    outputJson: text("output_json"),
  },
  (t) => [index("idx_step_runs_run_id").on(t.runId)],
);

/** Stub bookings produced by the workflow (MVP). */
export const appointmentStubs = sqliteTable(
  "appointment_stubs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    doctorId: text("doctor_id").notNull(),
    startsAt: integer("starts_at", { mode: "number" }).notNull(),
    endsAt: integer("ends_at", { mode: "number" }).notNull(),
    patientNote: text("patient_note"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("idx_appointments_run_id").on(t.runId)],
);

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type WorkflowRunInsert = typeof workflowRuns.$inferInsert;
export type WorkflowStepRun = typeof workflowStepRuns.$inferSelect;
export type WorkflowStepRunInsert = typeof workflowStepRuns.$inferInsert;
export type AppointmentStub = typeof appointmentStubs.$inferSelect;
export type AppointmentStubInsert = typeof appointmentStubs.$inferInsert;
