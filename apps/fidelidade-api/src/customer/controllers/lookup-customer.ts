import { and, eq } from "drizzle-orm";
import db from "../../database";
import { customerTable } from "../../database/schema";
import { normalizeBrPhone } from "../../utils/phone";

export type LookupCustomerResult = {
  phone: string;
  customer: typeof customerTable.$inferSelect | null;
};

/**
 * Exact lookup for the stamp screen. Deliberately NOT a 404 on a miss: "this
 * number has no card yet" is the normal case at the counter, and the caller
 * needs the normalized phone back so it can hand it straight to find-or-create.
 */
async function lookupCustomer(
  storeId: string,
  rawPhone: string,
): Promise<LookupCustomerResult> {
  const phone = normalizeBrPhone(rawPhone);

  const [customer] = await db
    .select()
    .from(customerTable)
    .where(
      and(eq(customerTable.storeId, storeId), eq(customerTable.phone, phone)),
    )
    .limit(1);

  return { phone, customer: customer ?? null };
}

export default lookupCustomer;
