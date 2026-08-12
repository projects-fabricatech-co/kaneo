import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";
import getCustomer from "./get-customer";

/**
 * Name and notes only. The phone is the customer's identity — it backs the
 * `(storeId, phone)` unique index and the find-or-create lookup — so changing it
 * would silently split or merge people. A wrong number is fixed by archiving the
 * row and enrolling the right one.
 */
export type UpdateCustomerInput = {
  name?: string | null;
  notes?: string | null;
};

async function updateCustomer(
  storeId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const values: Partial<typeof customerTable.$inferInsert> = {};

  if (input.name !== undefined) {
    values.name = input.name?.trim() || null;
  }

  if (input.notes !== undefined) {
    values.notes = input.notes?.trim() || null;
  }

  if (Object.keys(values).length === 0) {
    return getCustomer(storeId, customerId);
  }

  const [updated] = await db
    .update(customerTable)
    .set(values)
    .where(
      and(eq(customerTable.id, customerId), eq(customerTable.storeId, storeId)),
    )
    .returning();

  if (!updated) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  return updated;
}

export default updateCustomer;
