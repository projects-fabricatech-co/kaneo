import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  codeAlreadyRedeemedError,
  codeExpiredError,
  codeNotFoundError,
  codeNotRedeemableError,
} from "../../code/code-error";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import {
  cardTable,
  programTable,
  rewardTable,
  storeTable,
} from "../../database/schema";

export type RedeemRewardInput = {
  storeId: string;
  code: string;
  redeemedByUserId: string;
};

export type RedeemRewardResult = {
  kind: "reward";
  reward: typeof rewardTable.$inferSelect;
  /** The cycle that was just closed, now `redeemed`. */
  card: typeof cardTable.$inferSelect;
  /** The fresh, empty card the customer starts filling immediately. */
  nextCard: typeof cardTable.$inferSelect;
};

/**
 * Picks the message for a redemption that matched nothing. ONE select, on the
 * same `(store_id, code)` the UPDATE just tried, purely so the lojista is told
 * which of the four things went wrong. It decides nothing — by the time it runs
 * the outcome is already settled.
 *
 * The store's timezone rides along so "já utilizado em 09/08/2026 14:32" reads
 * in the hour the shop actually experienced, not in UTC.
 */
async function explainFailure(
  tx: DatabaseExecutor,
  storeId: string,
  code: string,
): Promise<HTTPException> {
  const [row] = await tx
    .select({
      status: rewardTable.status,
      expiresAt: rewardTable.expiresAt,
      redeemedAt: rewardTable.redeemedAt,
      timezone: storeTable.timezone,
    })
    .from(rewardTable)
    .innerJoin(storeTable, eq(rewardTable.storeId, storeTable.id))
    .where(and(eq(rewardTable.storeId, storeId), eq(rewardTable.code, code)))
    .limit(1);

  if (!row) {
    return codeNotFoundError();
  }

  if (row.status === "redeemed") {
    return codeAlreadyRedeemedError(row.redeemedAt, row.timezone);
  }

  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return codeExpiredError(row.expiresAt, row.timezone);
  }

  return codeNotRedeemableError();
}

/**
 * Handing over the prize, and the moment the customer's next card begins.
 *
 * The redemption itself is ONE conditional UPDATE — no SELECT first, no row
 * lock. Under READ COMMITTED the second of two concurrent statements matching
 * the same row blocks, re-evaluates its WHERE against the committed result, and
 * finds `status = 'redeemed'`, so it matches nothing. Two cashiers scanning the
 * same code at the same second therefore produce exactly one success and one
 * 409, with no lock to acquire and nothing to roll back.
 *
 * `now()` and not a JS timestamp: expiry is arbitrated by the database clock,
 * the same one that stamped `expires_at`, so an API host with a skewed clock
 * cannot honour a dead code or refuse a live one.
 */
async function redeemReward(
  input: RedeemRewardInput,
): Promise<RedeemRewardResult> {
  const { storeId, code, redeemedByUserId } = input;

  return db.transaction(async (tx) => {
    const [reward] = await tx
      .update(rewardTable)
      .set({
        status: "redeemed",
        redeemedAt: sql`now()`,
        redeemedByUserId,
      })
      .where(
        and(
          eq(rewardTable.storeId, storeId),
          eq(rewardTable.code, code),
          eq(rewardTable.status, "pending"),
          or(
            isNull(rewardTable.expiresAt),
            gt(rewardTable.expiresAt, sql`now()`),
          ),
        ),
      )
      .returning();

    if (!reward) {
      throw await explainFailure(tx, storeId, code);
    }

    // Everything below is in the SAME transaction as the UPDATE above. A prize
    // handed over without the next card opening would leave the customer unable
    // to collect stamps; a card reset without the prize being spent would let
    // the code be used twice.

    const [card] = await tx
      .update(cardTable)
      .set({ status: "redeemed", redeemedAt: new Date() })
      .where(eq(cardTable.id, reward.cardId))
      .returning();

    if (!card) {
      throw new HTTPException(500, {
        message: "Não foi possível encerrar o cartão",
      });
    }

    // The CURRENT program goal, deliberately — unlike the closing card, which
    // keeps the snapshot it was opened with. A new cycle is a new agreement, so
    // a goal the owner raised last week applies from here on.
    const [program] = await tx
      .select({ stampsRequired: programTable.stampsRequired })
      .from(programTable)
      .where(eq(programTable.id, reward.programId))
      .limit(1);

    if (!program) {
      throw new HTTPException(500, {
        message: "Não foi possível abrir o próximo cartão",
      });
    }

    // The closing card left `cards_program_customer_live_unique` one statement
    // ago, which is what makes room for this insert — and what guarantees the
    // reset cannot double-fire: a second attempt would find no pending reward
    // and never reach this line.
    const [nextCard] = await tx
      .insert(cardTable)
      .values({
        storeId: reward.storeId,
        programId: reward.programId,
        customerId: reward.customerId,
        cycle: card.cycle + 1,
        stampsCount: 0,
        stampsRequired: program.stampsRequired,
        status: "active",
      })
      .returning();

    if (!nextCard) {
      throw new HTTPException(500, {
        message: "Não foi possível abrir o próximo cartão",
      });
    }

    return { kind: "reward", reward, card, nextCard };
  });
}

export default redeemReward;
