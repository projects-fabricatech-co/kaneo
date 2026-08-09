import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import { programTable } from "../../database/schema";

async function listPrograms(storeId: string, includeArchived = false) {
  return db
    .select()
    .from(programTable)
    .where(
      includeArchived
        ? eq(programTable.storeId, storeId)
        : and(
            eq(programTable.storeId, storeId),
            eq(programTable.status, "active"),
          ),
    )
    .orderBy(desc(programTable.createdAt));
}

export default listPrograms;
