import { count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeMemberTable, userTable } from "../../database/schema";
import { assertWithinLimit } from "../../plans/assert-within-limit";
import { resolvePlanForStore } from "../../plans/resolve-plan";
import type { StoreRole } from "../../utils/require-store-role";

export type AddMemberInput = {
  email: string;
  role: StoreRole;
};

async function addMember(
  storeId: string,
  invitedByUserId: string,
  input: AddMemberInput,
) {
  const email = input.email.trim().toLowerCase();

  const [user] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (!user) {
    throw new HTTPException(404, {
      message: "Nenhuma conta encontrada com este e-mail",
    });
  }

  const { plan, limits } = await resolvePlanForStore(storeId);

  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, {
      lockKey: `limit:members:${storeId}`,
      limit: limits.maxMembersPerStore,
      code: "maxMembersPerStore",
      plan,
      current: async () => {
        const [row] = await tx
          .select({ value: count() })
          .from(storeMemberTable)
          .where(eq(storeMemberTable.storeId, storeId));

        return Number(row?.value ?? 0);
      },
    });

    const [created] = await tx
      .insert(storeMemberTable)
      .values({
        storeId,
        userId: user.id,
        role: input.role,
        invitedByUserId,
      })
      .onConflictDoNothing({
        target: [storeMemberTable.storeId, storeMemberTable.userId],
      })
      .returning();

    if (!created) {
      throw new HTTPException(409, {
        message: "Esta pessoa já faz parte da equipe",
      });
    }

    return created;
  });
}

export default addMember;
