import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import type { schema } from "../database";
import { type CodeKind, generateShortCode } from "./short-code";

const MAX_ATTEMPTS = 5;

type CodedTable = PgTable & {
  storeId: PgColumn;
  code: PgColumn;
};

type InsertExecutor = Pick<NodePgDatabase<typeof schema>, "insert">;

/**
 * Short codes are only 6 chars from a 32-char alphabet, so collisions inside a
 * single store are rare but real. Instead of pre-checking (a TOCTOU race), we
 * let the `(store_id, code)` unique constraint arbitrate and retry with a fresh
 * code when it swallows the insert.
 */
export async function insertWithUniqueCode<T extends CodedTable>(
  tx: InsertExecutor,
  table: T,
  kind: CodeKind,
  values: Omit<T["$inferInsert"], "code">,
): Promise<T["$inferSelect"]> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateShortCode(kind);

    const rows = (await tx
      .insert(table)
      .values({ ...values, code } as T["$inferInsert"])
      .onConflictDoNothing({ target: [table.storeId, table.code] })
      .returning()) as T["$inferSelect"][];

    const [row] = rows;

    if (row) {
      return row;
    }
  }

  throw new HTTPException(500, {
    message: "Não foi possível gerar o código",
  });
}
