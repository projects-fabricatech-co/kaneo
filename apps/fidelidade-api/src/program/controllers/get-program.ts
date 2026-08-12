import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { programTable } from "../../database/schema";

/**
 * Scoped by storeId in SQL as well as by the middleware: two independent checks,
 * so a route wired with the wrong `storeAccess.fromX()` still cannot read across
 * tenants.
 */
async function getProgram(storeId: string, programId: string) {
  const [program] = await db
    .select()
    .from(programTable)
    .where(
      and(eq(programTable.id, programId), eq(programTable.storeId, storeId)),
    )
    .limit(1);

  if (!program) {
    throw new HTTPException(404, { message: "Programa não encontrado" });
  }

  return program;
}

export default getProgram;
