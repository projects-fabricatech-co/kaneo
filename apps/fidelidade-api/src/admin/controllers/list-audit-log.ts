import { desc } from "drizzle-orm";
import db from "../../database";
import { adminAuditLogTable } from "../../database/schema";

export const AUDIT_PAGE_SIZE = 50;

export type AuditLogEntry = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  storeId: string | null;
  reason: string | null;
  createdAt: Date;
};

export type AuditLogPage = {
  entries: AuditLogEntry[];
  /** True when another page exists behind this one. */
  hasMore: boolean;
};

/**
 * The log, newest first.
 *
 * `ipAddress` is stored but NEVER projected here. It is kept so an access can be
 * attributed if it ever has to be defended, and showing it on a routine screen
 * would make an address that exists for that one purpose into ambient data on a
 * page somebody leaves open — the same reasoning that keeps the consent record's
 * IP out of every read path.
 *
 * `adminUserId` is likewise left out: the e-mail snapshot is what a human reads,
 * and the id would only be useful for joining back to a `user` row this table
 * deliberately does not reference.
 *
 * Paginated by fetching one extra row rather than by counting: a `count(*)` over
 * a log that only grows is a full scan on every page view, to render a number
 * nobody acts on.
 */
async function listAuditLog(page = 0): Promise<AuditLogPage> {
  const rows = await db
    .select({
      id: adminAuditLogTable.id,
      adminEmail: adminAuditLogTable.adminEmail,
      action: adminAuditLogTable.action,
      targetType: adminAuditLogTable.targetType,
      targetId: adminAuditLogTable.targetId,
      storeId: adminAuditLogTable.storeId,
      reason: adminAuditLogTable.reason,
      createdAt: adminAuditLogTable.createdAt,
    })
    .from(adminAuditLogTable)
    .orderBy(desc(adminAuditLogTable.createdAt), desc(adminAuditLogTable.id))
    .limit(AUDIT_PAGE_SIZE + 1)
    .offset(page * AUDIT_PAGE_SIZE);

  return {
    entries: rows.slice(0, AUDIT_PAGE_SIZE),
    hasMore: rows.length > AUDIT_PAGE_SIZE,
  };
}

export default listAuditLog;
