import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import db from "../../database";
import { rewardTable } from "../../database/schema";

export const DEFAULT_PENDING_REWARD_PAGE_SIZE = 50;

/**
 * "Prêmios aguardando retirada" — the dashboard tile, and the same predicate the
 * redemption UPDATE uses, so what the tile counts is exactly what a cashier can
 * still hand over. An expired code is not waiting for anything, so it is out.
 *
 * `now()` rather than a JS timestamp: the cutoff has to be the database's clock,
 * the one the redemption is arbitrated against.
 *
 * Oldest first: the ones closest to expiring are the ones worth chasing.
 */
async function listPendingRewards(storeId: string, limit?: number) {
  return db
    .select()
    .from(rewardTable)
    .where(
      and(
        eq(rewardTable.storeId, storeId),
        eq(rewardTable.status, "pending"),
        or(
          isNull(rewardTable.expiresAt),
          gt(rewardTable.expiresAt, sql`now()`),
        ),
      ),
    )
    .orderBy(asc(rewardTable.createdAt))
    .limit(limit ?? DEFAULT_PENDING_REWARD_PAGE_SIZE);
}

export default listPendingRewards;
