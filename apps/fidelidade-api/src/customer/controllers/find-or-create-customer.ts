import { and, count, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import { customerTable } from "../../database/schema";
import { assertWithinLimit } from "../../plans/assert-within-limit";
import { resolvePlanForStore } from "../../plans/resolve-plan";
import { normalizeBrPhone } from "../../utils/phone";
import { generatePublicToken } from "../../utils/tokens";

export type FindOrCreateCustomerInput = {
  phone: string;
  name?: string | null;
  notes?: string | null;
};

export type FindOrCreateCustomerResult = {
  customer: typeof customerTable.$inferSelect;
  created: boolean;
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function findByPhone(
  executor: DatabaseExecutor,
  storeId: string,
  phone: string,
) {
  const [existing] = await executor
    .select()
    .from(customerTable)
    .where(
      and(eq(customerTable.storeId, storeId), eq(customerTable.phone, phone)),
    )
    .limit(1);

  return existing ?? null;
}

/**
 * The counter workflow: a cashier types a phone number and either recognises an
 * existing customer or enrols a new one, in one call.
 */
async function findOrCreateCustomer(
  storeId: string,
  input: FindOrCreateCustomerInput,
): Promise<FindOrCreateCustomerResult> {
  // FIRST — this throws 422 on an unusable number, and everything downstream
  // (the unique index, the lookup) assumes the normalized form.
  const phone = normalizeBrPhone(input.phone);

  const existing = await findByPhone(db, storeId, phone);

  // An EXISTING customer is served without consulting the plan: a store that
  // lapsed from Pro back to Grátis with 800 customers must still be able to
  // stamp all 800 of them. Only new acquisition is gated.
  //
  // Archived customers resolve here too, rather than being enrolled a second
  // time — the phone number is the identity and the unique index enforces it.
  if (existing) {
    return { customer: existing, created: false };
  }

  const { plan, limits } = await resolvePlanForStore(storeId);

  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, {
      lockKey: `limit:customers:${storeId}`,
      limit: limits.maxCustomersPerStore,
      code: "maxCustomersPerStore",
      plan,
      current: async () => {
        const [row] = await tx
          .select({ value: count() })
          .from(customerTable)
          .where(
            and(
              eq(customerTable.storeId, storeId),
              isNull(customerTable.archivedAt),
            ),
          );

        return Number(row?.value ?? 0);
      },
    });

    const [created] = await tx
      .insert(customerTable)
      .values({
        storeId,
        phone,
        name: trimmedOrNull(input.name),
        notes: trimmedOrNull(input.notes),
        publicToken: generatePublicToken(),
      })
      // The unique index is the real guarantee, not the SELECT above: two
      // cashiers can type the same number at the same instant.
      .onConflictDoNothing({
        target: [customerTable.storeId, customerTable.phone],
      })
      .returning();

    if (created) {
      return { customer: created, created: true };
    }

    // On the transaction handle, not the pool: holding a transaction while
    // checking out a second connection is how a bounded pool deadlocks.
    const raced = await findByPhone(tx, storeId, phone);

    if (!raced) {
      throw new HTTPException(500, {
        message: "Não foi possível cadastrar o cliente",
      });
    }

    return { customer: raced, created: false };
  });
}

export default findOrCreateCustomer;
