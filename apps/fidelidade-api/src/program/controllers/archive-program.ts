import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { programTable } from "../../database/schema";

/**
 * Soft retire. The cards, stamps and history stay exactly where they are — only
 * new stamps are refused, because `create-stamp` requires `status = 'active'`.
 * Archiving also frees the name, since the unique index is partial on
 * `status = 'active'`.
 */
async function archiveProgram(storeId: string, programId: string) {
  const [archived] = await db
    .update(programTable)
    .set({ status: "archived" })
    .where(
      and(eq(programTable.id, programId), eq(programTable.storeId, storeId)),
    )
    .returning();

  if (!archived) {
    throw new HTTPException(404, { message: "Programa não encontrado" });
  }

  return archived;
}

export default archiveProgram;
