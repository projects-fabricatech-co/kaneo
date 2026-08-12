import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";
import createStamp, { type CreateStampResult } from "./create-stamp";

export type CreateStampByTokenInput = {
  storeId: string;
  programId: string;
  /** The customer's `publicToken`, read from their QR code. */
  token: string;
  idempotencyKey: string;
  source: "manual" | "qr";
  createdByUserId: string;
};

/**
 * The QR path. The token identifies WHICH customer, and nothing more — the
 * caller still has to be an authenticated member of the store, enforced by the
 * auth gate and `storeAccess` on the route. A customer holding their own token
 * can never mint a stamp for themselves.
 *
 * The token is resolved WITHIN the store: a token belonging to another shop's
 * customer is a 404 here, so scanning a competitor's card cannot reveal that it
 * exists.
 */
async function createStampByToken(
  input: CreateStampByTokenInput,
): Promise<CreateStampResult> {
  const [customer] = await db
    .select({ id: customerTable.id })
    .from(customerTable)
    .where(
      and(
        eq(customerTable.publicToken, input.token),
        eq(customerTable.storeId, input.storeId),
        isNull(customerTable.archivedAt),
      ),
    )
    .limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  return createStamp({
    storeId: input.storeId,
    programId: input.programId,
    customerId: customer.id,
    idempotencyKey: input.idempotencyKey,
    source: input.source,
    createdByUserId: input.createdByUserId,
  });
}

export default createStampByToken;
