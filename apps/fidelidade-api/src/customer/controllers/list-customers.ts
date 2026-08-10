import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";
import { isValidBrPhone, normalizeBrPhone } from "../../utils/phone";

export const DEFAULT_CUSTOMER_PAGE_SIZE = 25;

export type ListCustomersOptions = {
  q?: string;
  limit?: number;
  cursor?: string;
};

type Cursor = { createdAt: string; id: string };

/**
 * `(createdAt, id)` rather than an offset: a shop stamping customers while the
 * owner scrolls would otherwise shift rows between pages. The `id` tiebreaker
 * matters because two customers created in the same millisecond are ordinary.
 */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(
    `${row.createdAt.toISOString()}|${row.id}`,
    "utf8",
  ).toString("base64url");
}

function decodeCursor(raw: string): Cursor {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const separator = decoded.indexOf("|");
  const createdAt = separator === -1 ? "" : decoded.slice(0, separator);
  const id = separator === -1 ? "" : decoded.slice(separator + 1);

  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
    throw new HTTPException(400, {
      message: "Não foi possível carregar esta página da lista",
    });
  }

  return { createdAt, id };
}

/** `%` and `_` are wildcards in LIKE; a customer named "50%" must not match all. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function listCustomers(
  storeId: string,
  { q, limit, cursor }: ListCustomersOptions = {},
) {
  const pageSize = limit ?? DEFAULT_CUSTOMER_PAGE_SIZE;

  // Archived customers are hidden from the browse list. `lookup` and
  // find-or-create still resolve them, so an archived person is not silently
  // duplicated the next time they hand over their phone number.
  const filters = [
    eq(customerTable.storeId, storeId),
    isNull(customerTable.archivedAt),
  ];

  const term = q?.trim();

  if (term) {
    // Three ways to find a person, OR'd together, because the lojista is typing
    // whatever the customer just said out loud.
    //
    // 1. A complete number, matched EXACTLY after normalization: "11 8765-4321"
    //    and "+5511987654321" are the same person.
    // 2. A PARTIAL run of digits, matched as a substring of the stored E.164.
    //    People give their number without the DDD ("98888-0001") far more often
    //    than with it, and exact-match-only turns the search box on the one
    //    screen whose job is finding someone into a box that finds nobody.
    //    Four digits minimum, so a stray "1" does not return the whole shop.
    // 3. The name, as a case-insensitive substring.
    const digits = term.replace(/\D/g, "");
    const conditions = [
      ilike(customerTable.name, `%${escapeLikePattern(term)}%`),
    ];

    if (isValidBrPhone(term)) {
      conditions.push(eq(customerTable.phone, normalizeBrPhone(term)));
    }

    if (digits.length >= 4) {
      conditions.push(ilike(customerTable.phone, `%${digits}%`));
    }

    const search = or(...conditions);

    if (search) {
      filters.push(search);
    }
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    filters.push(
      sql`(${customerTable.createdAt}, ${customerTable.id}) < (${decoded.createdAt}::timestamptz, ${decoded.id}::text)`,
    );
  }

  const rows = await db
    .select()
    .from(customerTable)
    .where(and(...filters))
    .orderBy(desc(customerTable.createdAt), desc(customerTable.id))
    .limit(pageSize + 1);

  const items = rows.slice(0, pageSize);
  const last = items.at(-1);

  return {
    items,
    nextCursor: rows.length > pageSize && last ? encodeCursor(last) : null,
  };
}

export default listCustomers;
