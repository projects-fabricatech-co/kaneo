import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";
import { generatePublicToken } from "../../utils/tokens";

/**
 * Revokes a leaked card link. The old token stops resolving the instant this
 * commits, which is the whole point — there is no grace period, because the
 * reason to rotate is that someone else has the link.
 *
 * No retry loop on the unique index: the token is 128 bits of CSPRNG output, so
 * a collision is not a failure mode worth code.
 */
async function rotateCustomerToken(storeId: string, customerId: string) {
  const [updated] = await db
    .update(customerTable)
    .set({ publicToken: generatePublicToken() })
    .where(
      and(eq(customerTable.id, customerId), eq(customerTable.storeId, storeId)),
    )
    .returning();

  if (!updated) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  return updated;
}

export default rotateCustomerToken;
