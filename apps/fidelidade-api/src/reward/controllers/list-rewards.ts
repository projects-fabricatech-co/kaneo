import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { rewardTable } from "../../database/schema";

export const DEFAULT_REWARD_PAGE_SIZE = 50;

export type ListRewardsOptions = {
  status?: "pending" | "redeemed";
  limit?: number;
};

/**
 * The owner's ledger of prizes issued. Redeemed rewards are INCLUDED by default
 * on purpose — "quantos prêmios eu já entreguei" is the question this screen
 * exists to answer — and `status` narrows it when the caller wants one side.
 *
 * Expiry is NOT a status here: a code's status column only ever says `pending`
 * or `redeemed`, and whether a pending one has run out of time is derived from
 * `expiresAt` by whoever renders it. `/pending` below is the filtered view for
 * the dashboard.
 */
async function listRewards(
  storeId: string,
  { status, limit }: ListRewardsOptions = {},
) {
  const filters = [eq(rewardTable.storeId, storeId)];

  if (status) {
    filters.push(eq(rewardTable.status, status));
  }

  return db
    .select()
    .from(rewardTable)
    .where(and(...filters))
    .orderBy(desc(rewardTable.createdAt))
    .limit(limit ?? DEFAULT_REWARD_PAGE_SIZE);
}

export default listRewards;
