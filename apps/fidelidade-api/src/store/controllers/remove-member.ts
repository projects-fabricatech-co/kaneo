import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeMemberTable } from "../../database/schema";

async function removeMember(storeId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(storeMemberTable)
      .where(
        and(
          eq(storeMemberTable.storeId, storeId),
          eq(storeMemberTable.userId, userId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new HTTPException(404, { message: "Membro não encontrado" });
    }

    if (member.role === "owner") {
      const [owners] = await tx
        .select({ value: count() })
        .from(storeMemberTable)
        .where(
          and(
            eq(storeMemberTable.storeId, storeId),
            eq(storeMemberTable.role, "owner"),
          ),
        );

      if (Number(owners?.value ?? 0) <= 1) {
        throw new HTTPException(409, {
          message: "A loja precisa de pelo menos um proprietário",
        });
      }
    }

    await tx
      .delete(storeMemberTable)
      .where(
        and(
          eq(storeMemberTable.storeId, storeId),
          eq(storeMemberTable.userId, userId),
        ),
      );

    return { success: true as const };
  });
}

export default removeMember;
