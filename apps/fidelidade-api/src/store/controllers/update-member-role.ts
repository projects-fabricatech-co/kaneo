import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeMemberTable } from "../../database/schema";
import type { StoreRole } from "../../utils/require-store-role";

async function updateMemberRole(
  storeId: string,
  userId: string,
  role: StoreRole,
) {
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

    // A store with zero owners can never be administered again.
    if (member.role === "owner" && role !== "owner") {
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

    const [updated] = await tx
      .update(storeMemberTable)
      .set({ role })
      .where(
        and(
          eq(storeMemberTable.storeId, storeId),
          eq(storeMemberTable.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Membro não encontrado" });
    }

    return updated;
  });
}

export default updateMemberRole;
