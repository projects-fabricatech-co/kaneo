import { sql } from "drizzle-orm";

type Executor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/**
 * Transaction-scoped advisory lock, released automatically on commit/rollback.
 *
 * `hashtextextended(text, int8)` returns bigint, which matches the single-arg
 * `pg_advisory_xact_lock(bigint)` overload. Plain `hashtext` is only 32-bit and
 * would resolve to the two-arg (int, int) overload with a different key space.
 */
export async function acquireAdvisoryLock(
  tx: Executor,
  key: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}
