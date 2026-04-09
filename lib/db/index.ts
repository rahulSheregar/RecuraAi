import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

import * as schema from "./schema";

const DB_FILENAME = "recura.db";

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function dataDir() {
  return path.join(process.cwd(), "data");
}

function dbFilePath() {
  return path.join(dataDir(), DB_FILENAME);
}

/**
 * SQLite + Drizzle. Runs migrations on first open. Use only from server code
 * (Route Handlers, Server Actions, `server-only` modules).
 */
export function getDb() {
  if (db) return db;

  const dir = dataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = dbFilePath();
  sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const drizzleDb = drizzle(sqlite, { schema });

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (fs.existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
    migrate(drizzleDb, { migrationsFolder });
  }

  db = drizzleDb;
  return db;
}

/** Close DB (e.g. tests). */
export function closeDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export { schema };
