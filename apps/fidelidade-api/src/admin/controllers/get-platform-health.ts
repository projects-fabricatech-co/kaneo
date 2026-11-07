import { desc, gte, sql } from "drizzle-orm";
import { isBillingConfigured } from "../../billing/config";
import db from "../../database";
import {
  stripeEventTable,
  stripeWebhookFailureTable,
} from "../../database/schema";

export type WebhookEventCount = {
  eventType: string;
  count: number;
};

export type WebhookFailure = {
  id: string;
  eventId: string | null;
  eventType: string | null;
  reason: string;
  message: string | null;
  createdAt: Date;
};

export type PlatformHealth = {
  billingConfigured: boolean;
  /** When the last Stripe event was accepted. Null before the first one. */
  lastStripeEventAt: Date | null;
  lastStripeEventType: string | null;
  stripeEvents24h: WebhookEventCount[];
  webhookFailures24h: number;
  recentWebhookFailures: WebhookFailure[];
  /** Hash of the newest applied migration, and when it landed. */
  lastMigrationHash: string | null;
  lastMigrationAt: Date | null;
  /** Round trip for `select 1`, in milliseconds. */
  databaseLatencyMs: number;
};

const RECENT_FAILURE_LIMIT = 20;

/**
 * How far behind the migration state can be read from.
 *
 * The drizzle migrator writes here itself; there is no application table that
 * mirrors it, and inventing one would create a second answer to "which version
 * is deployed" that can disagree with the first.
 */
type MigrationRow = { hash: string; created_at: string | number | null };

async function readLastMigration(): Promise<{
  hash: string | null;
  at: Date | null;
}> {
  try {
    const { rows } = await db.execute<MigrationRow>(sql`
      select hash, created_at
        from drizzle.__drizzle_migrations
       order by created_at desc
       limit 1
    `);

    const row = rows[0];

    if (!row) {
      return { hash: null, at: null };
    }

    // `created_at` is stored as epoch milliseconds by the migrator, and comes
    // back from node-postgres as a string because it is a bigint.
    const millis = row.created_at === null ? null : Number(row.created_at);

    return {
      hash: row.hash,
      at: millis !== null && Number.isFinite(millis) ? new Date(millis) : null,
    };
  } catch (error) {
    // A missing schema is not a reason to fail the whole health page — the page
    // exists to report problems, so it has to survive one.
    console.error("fidelidade: could not read migration state", error);
    return { hash: null, at: null };
  }
}

/**
 * Is the system up, and is money still arriving?
 *
 * The Stripe half is deliberately built from two tables that answer different
 * questions. `stripe_event` says what DID land, and its most useful field is the
 * timestamp of the last one: webhooks failing in series looks, from inside the
 * database, exactly like a quiet afternoon, and the only way to tell them apart
 * is how long the silence has run. `stripe_webhook_failures` says what did not
 * land, which `stripe_event` structurally cannot record.
 */
async function getPlatformHealth(): Promise<PlatformHealth> {
  const since24h = sql`now() - interval '24 hours'`;

  const startedAt = performance.now();
  await db.execute(sql`select 1`);
  const databaseLatencyMs = Math.round(performance.now() - startedAt);

  const [lastEventRows, events24h, failureCount, recentFailures, migration] =
    await Promise.all([
      db
        .select({
          createdAt: stripeEventTable.createdAt,
          eventType: stripeEventTable.eventType,
        })
        .from(stripeEventTable)
        .orderBy(desc(stripeEventTable.createdAt))
        .limit(1),

      db
        .select({
          eventType: stripeEventTable.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(stripeEventTable)
        .where(gte(stripeEventTable.createdAt, since24h))
        .groupBy(stripeEventTable.eventType)
        .orderBy(desc(sql`count(*)`)),

      db
        .select({ value: sql<number>`count(*)::int` })
        .from(stripeWebhookFailureTable)
        .where(gte(stripeWebhookFailureTable.createdAt, since24h)),

      db
        .select({
          id: stripeWebhookFailureTable.id,
          eventId: stripeWebhookFailureTable.eventId,
          eventType: stripeWebhookFailureTable.eventType,
          reason: stripeWebhookFailureTable.reason,
          message: stripeWebhookFailureTable.message,
          createdAt: stripeWebhookFailureTable.createdAt,
        })
        .from(stripeWebhookFailureTable)
        .orderBy(desc(stripeWebhookFailureTable.createdAt))
        .limit(RECENT_FAILURE_LIMIT),

      readLastMigration(),
    ]);

  const lastEvent = lastEventRows[0];

  return {
    billingConfigured: isBillingConfigured(),
    lastStripeEventAt: lastEvent?.createdAt ?? null,
    lastStripeEventType: lastEvent?.eventType ?? null,
    stripeEvents24h: events24h,
    webhookFailures24h: failureCount[0]?.value ?? 0,
    recentWebhookFailures: recentFailures,
    lastMigrationHash: migration.hash,
    lastMigrationAt: migration.at,
    databaseLatencyMs,
  };
}

export default getPlatformHealth;
