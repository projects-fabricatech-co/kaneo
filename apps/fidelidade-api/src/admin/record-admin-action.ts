import type { Context } from "hono";
import db from "../database";
import type { DatabaseExecutor } from "../database/executor";
import { adminAuditLogTable } from "../database/schema";

export type AdminAuditEntry = {
  adminUserId: string;
  adminEmail: string;
  /** Dotted verb, e.g. `admin.metrics.read`. */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  storeId?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
};

/**
 * Appends one row to the audit log.
 *
 * Deliberately NOT fire-and-forget. Callers `await` this BEFORE doing the read
 * it describes, so a log that cannot be written stops the read from happening —
 * the alternative is a console that keeps answering questions about people
 * while quietly failing to record that it did. An audit log that is best-effort
 * is a log you cannot cite.
 *
 * Takes an executor so a future action that writes can put its own change and
 * the record of it in the same transaction.
 */
export async function recordAdminAction(
  entry: AdminAuditEntry,
  tx: DatabaseExecutor = db,
): Promise<void> {
  await tx.insert(adminAuditLogTable).values({
    adminUserId: entry.adminUserId,
    adminEmail: entry.adminEmail,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    storeId: entry.storeId ?? null,
    reason: entry.reason ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}

/**
 * The caller's address, as the proxy in front of us reports it.
 *
 * First hop of `x-forwarded-for` only: the header is a client-controlled list
 * and everything after the first entry can be forged by whoever sent the
 * request. Recorded as evidence, never used to make a decision.
 */
export function callerIp(c: Context): string | null {
  const forwarded = c.req.header("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return c.req.header("x-real-ip")?.trim() || null;
}

/**
 * Logs an admin action straight from the request context.
 *
 * The one call site pattern for every admin route, so no controller has to
 * remember which four things go into a row.
 */
export async function recordFromContext(
  c: Context,
  entry: Omit<AdminAuditEntry, "adminUserId" | "adminEmail" | "ipAddress">,
): Promise<void> {
  await recordAdminAction({
    ...entry,
    adminUserId: c.get("adminUserId") as string,
    adminEmail: c.get("adminEmail") as string,
    reason: entry.reason ?? (c.get("adminReason") as string | undefined) ?? null,
    ipAddress: callerIp(c),
  });
}
