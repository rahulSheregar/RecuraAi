/**
 * Seeds SQLite with the sample doctor scenario and writes public/fixtures/sample-doctors.json.
 * Run: npm run scenario:doctors
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeDb } from "../lib/db/sqlite";
import { listDoctorProfiles, seedSampleDoctorsToDb } from "../lib/db/doctors";
import { STORAGE_KEY } from "../lib/doctor-profiles";
import { SAMPLE_DOCTOR_SCENARIOS } from "../lib/sample-doctors-scenario";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/fixtures");
const outFile = join(outDir, "sample-doctors.json");

try {
  const { count } = seedSampleDoctorsToDb();
  console.log(`Seeded ${count} doctors into data/recura.db`);

  mkdirSync(outDir, { recursive: true });
  const profiles = listDoctorProfiles();
  const payload = {
    storageKey: STORAGE_KEY,
    description:
      "Canonical store is SQLite table doctor_profiles. This JSON mirrors the API GET /api/doctors response for fixtures and docs.",
    scenariosMeta: SAMPLE_DOCTOR_SCENARIOS.map(({ id, slug, intent }) => ({
      id,
      slug,
      intent,
    })),
    profiles,
  };
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outFile}`);
} finally {
  closeDb();
}
