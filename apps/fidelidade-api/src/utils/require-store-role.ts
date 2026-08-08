import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

export type StoreRole = "owner" | "cashier";

/**
 * Reads the role that `storeAccess.*` already resolved, so this costs no extra
 * query. Must run AFTER a store-access middleware.
 *
 * 403 here is correct and intentional: by this point the caller has proven
 * membership, so there is nothing left to enumerate.
 */
export function requireStoreRole(...roles: StoreRole[]) {
  return async (c: Context, next: Next) => {
    const role = c.get("storeRole") as StoreRole | undefined;

    if (!role || !roles.includes(role)) {
      throw new HTTPException(403, {
        message: "Ação permitida apenas ao proprietário",
      });
    }

    return next();
  };
}
