import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import {
  cardTable,
  customerTable,
  programTable,
  rewardTable,
  stampTable,
} from "../../database/schema";
import { rewardExpiresAt } from "../../reward/reward-expiry";
import { acquireAdvisoryLock } from "../../utils/advisory-lock";
import { insertWithUniqueCode } from "../../utils/insert-with-unique-code";
import { evaluateCooldown } from "../cooldown";
import { stampCooldownError } from "../cooldown-error";

export type CreateStampInput = {
  storeId: string;
  programId: string;
  customerId: string;
  /** REQUIRED. The only thing that makes a retried stamp safe. */
  idempotencyKey: string;
  source: "manual" | "qr";
  createdByUserId: string;
};

export type CreateStampResult = {
  stamp: typeof stampTable.$inferSelect;
  card: typeof cardTable.$inferSelect;
  /** True when the key had already been used: nothing new was written. */
  replayed: boolean;
  /**
   * The reward this card carries, when the stamp completed it — so the stamp
   * screen can show the code immediately instead of round-tripping. Null while
   * the card is still filling. A replay reports the reward the original request
   * created, because the cashier's phone may be retrying exactly the response
   * that carried it.
   */
  reward: typeof rewardTable.$inferSelect | null;
};

/** The card the customer is currently filling, if any. */
async function loadLiveCard(
  tx: DatabaseExecutor,
  programId: string,
  customerId: string,
) {
  const [card] = await tx
    .select()
    .from(cardTable)
    .where(
      and(
        eq(cardTable.programId, programId),
        eq(cardTable.customerId, customerId),
        inArray(cardTable.status, ["active", "completed"]),
      ),
    )
    .limit(1);

  return card ?? null;
}

async function loadCardById(tx: DatabaseExecutor, cardId: string) {
  const [card] = await tx
    .select()
    .from(cardTable)
    .where(eq(cardTable.id, cardId))
    .limit(1);

  return card ?? null;
}

/** At most one, by `rewards_cardId_unique`. */
async function loadRewardByCardId(tx: DatabaseExecutor, cardId: string) {
  const [reward] = await tx
    .select()
    .from(rewardTable)
    .where(eq(rewardTable.cardId, cardId))
    .limit(1);

  return reward ?? null;
}

/**
 * The critical write in the whole product. Two cashiers on two phones, a
 * double-tapped button and a flaky connection all converge here, and the invariant
 * is that a customer's card advances by exactly one stamp per genuine intent.
 *
 * Everything runs in ONE transaction so a failure anywhere leaves no partial
 * state: no stamp without a counter increment, no completed card without the
 * stamp that completed it.
 */
async function createStamp(
  input: CreateStampInput,
): Promise<CreateStampResult> {
  const {
    storeId,
    programId,
    customerId,
    idempotencyKey,
    source,
    createdByUserId,
  } = input;

  return db.transaction(async (tx) => {
    // 1. FIRST statement, before any read. A lock taken after a read is not a
    //    lock: the read already happened on a stale snapshot and the race is
    //    back. Transaction-scoped, so it releases on commit or rollback.
    await acquireAdvisoryLock(tx, `stamp:${programId}:${customerId}`);

    // 2. Both parents must belong to the authenticated store. Scoping in SQL
    //    here as well as in the middleware means a mis-wired route still cannot
    //    write across tenants, and a mismatch is a 404 rather than a 403 so the
    //    endpoint is not a cross-tenant enumeration oracle.
    const [program] = await tx
      .select()
      .from(programTable)
      .where(
        and(
          eq(programTable.id, programId),
          eq(programTable.storeId, storeId),
          eq(programTable.status, "active"),
        ),
      )
      .limit(1);

    if (!program) {
      throw new HTTPException(404, { message: "Programa não encontrado" });
    }

    const [customer] = await tx
      .select({ id: customerTable.id })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.id, customerId),
          eq(customerTable.storeId, storeId),
        ),
      )
      .limit(1);

    if (!customer) {
      throw new HTTPException(404, { message: "Cliente não encontrado" });
    }

    // 3. Cooldown, against the most recent stamp that still counts.
    const [last] = await tx
      .select()
      .from(stampTable)
      .where(
        and(
          eq(stampTable.customerId, customerId),
          eq(stampTable.programId, programId),
          isNull(stampTable.voidedAt),
        ),
      )
      .orderBy(desc(stampTable.createdAt))
      .limit(1);

    // A retry of the request that produced that very stamp is NOT a cooldown
    // violation — the cashier's intent was already satisfied, and answering 429
    // would turn a dropped response into a phantom error. This has to be checked
    // before the cooldown, because under the advisory lock the retry always sees
    // its own stamp as "the most recent one".
    if (last && last.idempotencyKey === idempotencyKey) {
      const card = await loadCardById(tx, last.cardId);

      if (!card) {
        throw new HTTPException(500, {
          message: "Não foi possível ler o cartão",
        });
      }

      return {
        stamp: last,
        card,
        replayed: true,
        reward: await loadRewardByCardId(tx, card.id),
      };
    }

    const cooldown = evaluateCooldown(
      last?.createdAt ?? null,
      program.cooldownMinutes,
      new Date(),
    );

    if (cooldown.blocked) {
      throw stampCooldownError(
        cooldown.retryAfterSeconds,
        await loadLiveCard(tx, programId, customerId),
      );
    }

    // 4. Resolve the card the customer is filling, or open a new cycle.
    let card = await loadLiveCard(tx, programId, customerId);

    if (!card) {
      const [cycleRow] = await tx
        .select({ value: max(cardTable.cycle) })
        .from(cardTable)
        .where(
          and(
            eq(cardTable.programId, programId),
            eq(cardTable.customerId, customerId),
          ),
        );

      const [opened] = await tx
        .insert(cardTable)
        .values({
          storeId,
          programId,
          customerId,
          cycle: Number(cycleRow?.value ?? 0) + 1,
          // SNAPSHOT. Raising the program goal tomorrow must not move the finish
          // line for a card the customer is already halfway through.
          stampsRequired: program.stampsRequired,
        })
        .returning();

      if (!opened) {
        throw new HTTPException(500, {
          message: "Não foi possível abrir o cartão",
        });
      }

      card = opened;
    }

    // 5. A full card has to be redeemed before it can take more stamps,
    //    otherwise the extra stamps are simply lost when the cycle closes.
    if (card.status === "completed") {
      throw new HTTPException(409, {
        message: "Cartão completo. Resgate o prêmio antes de carimbar.",
      });
    }

    // 6. The unique index on `(cardId, idempotencyKey)` is the guarantee, not the
    //    lookup above.
    const [inserted] = await tx
      .insert(stampTable)
      .values({
        storeId,
        programId,
        customerId,
        cardId: card.id,
        createdByUserId,
        source,
        idempotencyKey,
      })
      .onConflictDoNothing({
        target: [stampTable.cardId, stampTable.idempotencyKey],
      })
      .returning();

    if (!inserted) {
      // Same key, same card, but not the most recent stamp — reached when the
      // cooldown is 0 and the cashier stamped someone else in between. A replay,
      // not an error: return the state the earlier request already produced.
      const [existing] = await tx
        .select()
        .from(stampTable)
        .where(
          and(
            eq(stampTable.cardId, card.id),
            eq(stampTable.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);

      const current = await loadCardById(tx, card.id);

      if (!existing || !current) {
        throw new HTTPException(500, {
          message: "Não foi possível registrar o carimbo",
        });
      }

      return {
        stamp: existing,
        card: current,
        replayed: true,
        reward: await loadRewardByCardId(tx, current.id),
      };
    }

    // 7. Safe to compute from the value read above: every writer of this card
    //    holds the advisory lock acquired in step 1.
    const stampsCount = card.stampsCount + 1;
    const completed = stampsCount >= card.stampsRequired;

    const completedAt = new Date();

    const [updatedCard] = await tx
      .update(cardTable)
      .set({
        stampsCount,
        ...(completed ? { status: "completed", completedAt } : {}),
      })
      .where(eq(cardTable.id, card.id))
      .returning();

    if (!updatedCard) {
      throw new HTTPException(500, {
        message: "Não foi possível atualizar o cartão",
      });
    }

    // 8. The stamp that fills the card mints the reward, in THIS transaction and
    //    nowhere else: a reward created afterwards could be lost to a crash
    //    between the two writes, leaving a completed card the customer can
    //    neither add to (step 5 refuses) nor redeem.
    //
    //    No defensive pre-SELECT: `rewards_cardId_unique` is what makes this
    //    exactly-once, and it is reached only on the one stamp that flips the
    //    card, which itself only happens once thanks to the advisory lock and
    //    `stamps_card_idempotency_unique`.
    //
    //    The description is SNAPSHOT from the program, like `stampsRequired` on
    //    the card: editing "café grátis" into "café + pão" tomorrow must not
    //    silently change what an already-issued code promises.
    let reward: typeof rewardTable.$inferSelect | null = null;

    if (completed) {
      reward = await insertWithUniqueCode(tx, rewardTable, "reward", {
        storeId,
        programId,
        customerId,
        cardId: card.id,
        description: program.rewardDescription,
        expiresAt: rewardExpiresAt(program.rewardValidityDays, completedAt),
      });
    }

    // 9. Denormalized onto the customer so the list screen can show "última
    //    visita" without touching the stamp ledger.
    await tx
      .update(customerTable)
      .set({ lastStampAt: inserted.createdAt })
      .where(eq(customerTable.id, customerId));

    return { stamp: inserted, card: updatedCard, replayed: false, reward };
  });
}

export default createStamp;
