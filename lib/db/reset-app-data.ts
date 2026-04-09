import { getDb } from "./sqlite";
import { doctorProfiles, workflowRuns } from "./schema";

/**
 * Deletes all app-owned rows (workflows, appointments, doctors). Leaves Drizzle migrations intact.
 * Child rows under `workflow_runs` are removed via ON DELETE CASCADE.
 */
export function resetAppDatabase(): void {
  const db = getDb();
  db.transaction((tx) => {
    tx.delete(workflowRuns).run();
    tx.delete(doctorProfiles).run();
  });
}
