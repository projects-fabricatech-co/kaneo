import { and, eq } from "drizzle-orm";
import { codeNotFoundError } from "../../code/code-error";
import db from "../../database";
import { rewardTable } from "../../database/schema";

export type RewardCodeState = "pending" | "redeemed" | "expired";

export type InspectRewardResult = {
  kind: "reward";
  code: string;
  description: string;
  /**
   * DERIVED, not the column. `rewards.status` only ever says `pending` or
   * `redeemed`; expiry lives in `expiresAt`, and collapsing the two here is what
   * lets the screen render one badge instead of reimplementing the rule.
   */
  status: RewardCodeState;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  /** True exactly when `POST /code/redeem` would succeed right now. */
  usable: boolean;
};

/**
 * READ-ONLY, and that is the entire contract: the lojista types a code to see
 * what it promises BEFORE handing anything over, and looking must never spend.
 * No UPDATE, no transaction, no side effect of any kind belongs in this file.
 *
 * An unusable code is a 200 describing why, not an error — the screen still has
 * something to show ("já utilizado", "expirado"), and only a code that does not
 * exist has nothing to describe.
 *
 * Scoped to the store, so a code from another shop reads as "não encontrado"
 * rather than confirming it exists somewhere.
 */
async function inspectReward(
  storeId: string,
  code: string,
): Promise<InspectRewardResult> {
  const [row] = await db
    .select({
      code: rewardTable.code,
      description: rewardTable.description,
      status: rewardTable.status,
      expiresAt: rewardTable.expiresAt,
      redeemedAt: rewardTable.redeemedAt,
    })
    .from(rewardTable)
    .where(and(eq(rewardTable.storeId, storeId), eq(rewardTable.code, code)))
    .limit(1);

  if (!row) {
    throw codeNotFoundError();
  }

  const state: RewardCodeState =
    row.status === "redeemed"
      ? "redeemed"
      : row.expiresAt && row.expiresAt.getTime() <= Date.now()
        ? "expired"
        : "pending";

  return {
    kind: "reward",
    code: row.code,
    description: row.description,
    status: state,
    expiresAt: row.expiresAt,
    redeemedAt: row.redeemedAt,
    usable: state === "pending",
  };
}

export default inspectReward;
