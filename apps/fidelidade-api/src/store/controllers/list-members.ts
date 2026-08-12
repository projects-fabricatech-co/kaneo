import { eq } from "drizzle-orm";
import db from "../../database";
import { storeMemberTable, userTable } from "../../database/schema";

async function listMembers(storeId: string) {
  const rows = await db
    .select({
      id: storeMemberTable.id,
      storeId: storeMemberTable.storeId,
      userId: storeMemberTable.userId,
      role: storeMemberTable.role,
      invitedByUserId: storeMemberTable.invitedByUserId,
      createdAt: storeMemberTable.createdAt,
      updatedAt: storeMemberTable.updatedAt,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    })
    .from(storeMemberTable)
    .innerJoin(userTable, eq(storeMemberTable.userId, userTable.id))
    .where(eq(storeMemberTable.storeId, storeId))
    .orderBy(storeMemberTable.createdAt);

  return rows;
}

export default listMembers;
