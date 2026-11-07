import { and, eq, isNull } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { platformAdminTable, userTable } from "../database/schema";

export type AdminVariables = {
  adminUserId: string;
  adminEmail: string;
  adminReason: string;
};

/**
 * The gate on the owner's console.
 *
 * Runs AFTER the auth gate in `src/index.ts`, so `userId` is already resolved
 * and an anonymous caller has been answered with 401 before reaching here.
 *
 * A signed-in non-admin gets **404, never 403**. The rule is the same one the
 * store routes follow for another shop's resources, and it matters more here:
 * 403 would confirm that `/api/admin` exists and is worth attacking, turning
 * every lojista account into a probe for the one surface that reads across
 * every tenant.
 *
 * The revocation check is `revoked_at is null` rather than a delete, so a grant
 * that was taken away leaves a trace next to the log rows it explains.
 */
export function requirePlatformAdmin() {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId") as string | undefined;

    if (!userId) {
      throw new HTTPException(401, {
        message: "Sua sessão expirou. Entre novamente.",
      });
    }

    // The e-mail is joined in rather than read from the session because it is
    // what gets snapshotted into every audit row, and the session's copy is
    // only as fresh as the cookie.
    const [row] = await db
      .select({ email: userTable.email })
      .from(platformAdminTable)
      .innerJoin(userTable, eq(userTable.id, platformAdminTable.userId))
      .where(
        and(
          eq(platformAdminTable.userId, userId),
          isNull(platformAdminTable.revokedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "Não encontrado" });
    }

    c.set("adminUserId", userId);
    c.set("adminEmail", row.email);

    return next();
  };
}
