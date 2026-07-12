#!/usr/bin/env tsx
/**
 * Database migration script.
 * Applies schema.sql to the configured SQLite database.
 *
 * Usage: pnpm db:migrate
 */

import { getDb, closeDb } from "../src/db/connection";
import { seedDatabase } from "../src/db/seed";

async function main() {
  console.log("Applying schema...");
  const db = getDb();

  // Schema is applied on connection. Just verify tables exist.
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    )
    .all() as Array<{ name: string }>;

  console.log("Tables:", tables.map((t) => t.name).join(", "));

  const args = process.argv.slice(2);
  if (args.includes("--seed")) {
    console.log("Seeding synthetic data...");
    seedDatabase();
    console.log("Seed complete.");
  }

  closeDb();
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
