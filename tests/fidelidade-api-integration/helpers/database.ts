import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import db from "../../../apps/fidelidade-api/src/database";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(
  currentDir,
  "../../../apps/fidelidade-api/drizzle",
);

function testDatabaseUrl(): string {
  const url = process.env.FIDELIDADE_DATABASE_URL;

  if (!url) {
    throw new Error("FIDELIDADE_DATABASE_URL is not set (see setup.ts)");
  }

  return url;
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/** Creates the `*_test` database if it does not exist yet. */
export async function ensureTestDatabaseExists(): Promise<void> {
  const url = testDatabaseUrl();
  const name = databaseName(url);

  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to create a database not named *_test: ${name}`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    const { rows } = await adminPool.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );

    if (rows.length === 0) {
      // Identifiers cannot be parameterized; `name` is guaranteed to end in
      // `_test` and comes from our own env, not from a request.
      await adminPool.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await adminPool.end();
  }
}

let migrated: Promise<void> | undefined;

/** Runs migrations once per process. */
export async function ensureTestDatabaseMigrated(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      await ensureTestDatabaseExists();
      await migrate(db, { migrationsFolder });
    })();
  }

  return migrated;
}

/**
 * Empties every table between tests.
 *
 * The table list is DERIVED from the catalog rather than hand-maintained: a
 * hand-written list silently stops truncating a table the day someone adds one,
 * and the symptom is a later test failing for reasons unrelated to its subject.
 */
export async function resetTestDatabase(): Promise<void> {
  await ensureTestDatabaseMigrated();

  const result = await db.execute<{ tables: string | null }>(sql`
    select string_agg(format('%I', tablename), ', ') as tables
      from pg_tables
     where schemaname = 'public'
       and tablename <> '__drizzle_migrations'
  `);

  const tables = result.rows[0]?.tables;

  if (!tables) {
    return;
  }

  await db.execute(
    sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`),
  );
}
