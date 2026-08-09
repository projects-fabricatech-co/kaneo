import { and, eq, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { cardTable, stampTable } from "../../database/schema";
import { acquireAdvisoryLock } from "../../utils/advisory-lock";

export type VoidStampResult = {
  stamp: typeof stampTable.$inferSelect;
  card: typeof cardTable.$inferSelect;
};

/**
 * Owner-only, and that is a fraud control rather than a tidiness preference:
 * "carimbei sem querer" is the natural cover for a cashier handing out free
 * stamps and erasing the evidence. The row is never deleted — `voidedAt` and
 * `voidedByUserId` keep the attempt on the record.
 */
async function voidStamp(
  storeId: string,
  stampId: string,
  voidedByUserId: string,
): Promise<VoidStampResult> {
  return db.transaction(async (tx) => {
    // The lock key needs the stamp's program and customer, so this read comes
    // first — and is then REDONE under the lock, because the unlocked read could
    // race a concurrent stamp on the same card.
    const [probe] = await tx
      .select({
        programId: stampTable.programId,
        customerId: stampTable.customerId,
      })
      .from(stampTable)
      .where(and(eq(stampTable.id, stampId), eq(stampTable.storeId, storeId)))
      .limit(1);

    if (!probe) {
      throw new HTTPException(404, { message: "Carimbo não encontrado" });
    }

    // Same key space as `create-stamp`, so a void and a stamp on the same card
    // can never interleave.
    await acquireAdvisoryLock(
      tx,
      `stamp:${probe.programId}:${probe.customerId}`,
    );

    const [voided] = await tx
      .update(stampTable)
      .set({ voidedAt: new Date(), voidedByUserId })
      .where(
        and(
          eq(stampTable.id, stampId),
          eq(stampTable.storeId, storeId),
          // Voiding twice must not decrement the card twice.
          isNull(stampTable.voidedAt),
        ),
      )
      .returning();

    if (!voided) {
      const [already] = await tx
        .select()
        .from(stampTable)
        .where(and(eq(stampTable.id, stampId), eq(stampTable.storeId, storeId)))
        .limit(1);

      if (!already) {
        throw new HTTPException(404, { message: "Carimbo não encontrado" });
      }

      throw new HTTPException(409, {
        message: "Este carimbo já foi cancelado",
      });
    }

    // `greatest(... , 0)` in SQL rather than in JS: the floor is a property of
    // the column, and a seeded or repaired row must not be able to go negative.
    //
    // The card's `status` is deliberately left alone. A completed card carries a
    // reward from Phase 3 onwards, and un-completing it behind that reward's back
    // would be worse than a card sitting at 9/10 and completed.
    const [card] = await tx
      .update(cardTable)
      .set({ stampsCount: sql`greatest(${cardTable.stampsCount} - 1, 0)` })
      .where(eq(cardTable.id, voided.cardId))
      .returning();

    if (!card) {
      throw new HTTPException(500, {
        message: "Não foi possível atualizar o cartão",
      });
    }

    return { stamp: voided, card };
  });
}

export default voidStamp;
