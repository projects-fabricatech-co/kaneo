import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { storeMemberTable, storeTable } from "../../database/schema";

async function listStores(userId: string, includeArchived = false) {
  const rows = await db
    .select({
      store: storeTable,
      role: storeMemberTable.role,
    })
    .from(storeMemberTable)
    .innerJoin(storeTable, eq(storeMemberTable.storeId, storeTable.id))
    .where(
      includeArchived
        ? eq(storeMemberTable.userId, userId)
        : and(
            eq(storeMemberTable.userId, userId),
            isNull(storeTable.archivedAt),
          ),
    )
    .orderBy(storeTable.createdAt);

  return rows.map((row) => ({ ...row.store, role: row.role }));
}

export default listStores;
