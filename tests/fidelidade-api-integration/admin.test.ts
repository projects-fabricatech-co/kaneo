import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePlatformAdminBootstrap } from "../../apps/fidelidade-api/src/admin/bootstrap-platform-admin";
import db from "../../apps/fidelidade-api/src/database";
import {
  adminAuditLogTable,
  platformAdminTable,
} from "../../apps/fidelidade-api/src/database/schema";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCard,
  createCustomer,
  createPlatformAdmin,
  createProgram,
  createStamp,
  createStoreOwner,
  createUser,
  grantPlan,
} from "./helpers/fixtures";

/**
 * The owner's console.
 *
 * The subject here is not the numbers — it is who gets to see them. A surface
 * that reads across every tenant has exactly one interesting failure mode, and
 * it is a lojista discovering it exists.
 */
describe("API integration: admin console", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  const ADMIN_ROUTES = [
    "/api/admin/me",
    "/api/admin/metrics",
    "/api/admin/metrics/stamps-by-day",
    "/api/admin/health",
    "/api/admin/audit",
  ];

  describe("who gets in", () => {
    it("answers 401 to an anonymous caller, on every route", async () => {
      mockAnonymousSession();
      const { app } = createApp();

      for (const route of ADMIN_ROUTES) {
        const response = await app.request(route);
        expect(response.status, route).toBe(401);
      }
    });

    /**
     * The single most important assertion in this file.
     *
     * 403 would tell a signed-in lojista that `/api/admin` is a real surface
     * worth attacking. 404 tells them nothing, and matches how every other route
     * answers for a resource that belongs to somebody else.
     */
    it("answers 404 — never 403 — to a lojista who is not an admin", async () => {
      const { user } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      for (const route of ADMIN_ROUTES) {
        const response = await app.request(route);
        expect(response.status, route).toBe(404);
        expect(response.status, route).not.toBe(403);
      }
    });

    it("answers 404 once the grant is revoked", async () => {
      const admin = await createPlatformAdmin({ revokedAt: new Date() });
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/metrics");

      expect(response.status).toBe(404);
    });

    it("lets a live admin in and reports the identity back", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/me");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ email: admin.email });
    });
  });

  describe("the audit log", () => {
    it("records a row, with who and what, before answering", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      await app.request("/api/admin/metrics");

      const rows = await db
        .select()
        .from(adminAuditLogTable)
        .where(eq(adminAuditLogTable.action, "admin.metrics.read"));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.adminUserId).toBe(admin.id);
      expect(rows[0]?.adminEmail).toBe(admin.email);
    });

    it("records the address the caller came from", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      // Two hops. Only the first is trustworthy — everything after it is
      // attacker-controlled — so only the first is what we keep.
      await app.request("/api/admin/metrics", {
        headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.9" },
      });

      const [row] = await db.select().from(adminAuditLogTable);

      expect(row?.ipAddress).toBe("203.0.113.7");
    });

    it("reading the log is itself logged", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      await app.request("/api/admin/audit");
      const response = await app.request("/api/admin/audit");
      const body = (await response.json()) as {
        entries: { action: string; adminEmail: string }[];
        hasMore: boolean;
      };

      expect(body.entries[0]?.action).toBe("admin.audit.read");
      expect(body.entries[0]?.adminEmail).toBe(admin.email);
      expect(body.hasMore).toBe(false);
    });

    it("never projects the IP address onto the screen", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      await app.request("/api/admin/metrics", {
        headers: { "x-forwarded-for": "203.0.113.7" },
      });
      const response = await app.request("/api/admin/audit");
      const body = (await response.json()) as { entries: object[] };

      expect(JSON.stringify(body)).not.toContain("203.0.113.7");
      expect(body.entries[0]).not.toHaveProperty("ipAddress");
    });

    /**
     * The trigger, not the convention. An audit log that the next person in a
     * hurry can edit is a log nobody can cite.
     *
     * Asserted on the CAUSE rather than the message: Drizzle wraps a driver
     * error in one of its own that only reports the failing SQL, so a plain
     * `toThrow(/append-only/)` would fail even when the trigger fired — and,
     * worse, would pass for any other reason the query could break.
     */
    async function rejectionCause(promise: Promise<unknown>): Promise<string> {
      try {
        await promise;
      } catch (error) {
        const cause = (error as { cause?: unknown }).cause;
        return cause instanceof Error ? cause.message : String(error);
      }

      throw new Error("expected the query to be rejected, but it succeeded");
    }

    it("refuses UPDATE and DELETE at the database", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();
      await app.request("/api/admin/metrics");

      const onUpdate = await rejectionCause(
        db
          .update(adminAuditLogTable)
          .set({ action: "tampered" })
          .where(eq(adminAuditLogTable.action, "admin.metrics.read")),
      );

      const onDelete = await rejectionCause(
        db
          .delete(adminAuditLogTable)
          .where(eq(adminAuditLogTable.action, "admin.metrics.read")),
      );

      expect(onUpdate).toMatch(/append-only/i);
      expect(onDelete).toMatch(/append-only/i);

      // And the row is still there, unchanged.
      const rows = await db
        .select()
        .from(adminAuditLogTable)
        .where(eq(adminAuditLogTable.action, "admin.metrics.read"));

      expect(rows).toHaveLength(1);
    });
  });

  describe("métricas", () => {
    it("counts what exists, and leaves out what was archived or voided", async () => {
      const { user, store } = await createStoreOwner();
      const program = await createProgram(store.id);
      const alive = await createCustomer(store.id);
      await createCustomer(store.id, { archivedAt: new Date() });
      const card = await createCard(store.id, program.id, alive.id);
      await createStamp(card);
      await createStamp(card, { voidedAt: new Date() });

      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/metrics");
      const body = (await response.json()) as {
        accounts: number;
        stores: number;
        customers: number;
        stampsToday: number;
        timezone: string;
      };

      // The lojista, plus the admin.
      expect(body.accounts).toBe(2);
      expect(body.stores).toBe(1);
      expect(body.customers).toBe(1);
      expect(body.stampsToday).toBe(1);
      expect(body.timezone).toBe("America/Sao_Paulo");
      expect(user.id).toBeTruthy();
    });

    /**
     * MRR is the number the owner would act on, so what it excludes matters more
     * than what it adds up.
     */
    it("adds up only what is actually being paid", async () => {
      const essencial = await createUser();
      await grantPlan(essencial.id, "essencial", {
        status: "active",
        billingInterval: "monthly",
      });

      const proAnnual = await createUser();
      await grantPlan(proAnnual.id, "pro", {
        status: "active",
        billingInterval: "annual",
      });

      const trialing = await createUser();
      await grantPlan(trialing.id, "pro", {
        status: "trialing",
        billingInterval: "monthly",
      });

      const lapsed = await createUser();
      await grantPlan(lapsed.id, "pro", {
        status: "past_due",
        billingInterval: "monthly",
      });

      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/metrics");
      const body = (await response.json()) as {
        mrrCents: number;
        payingAccounts: number;
        trialingAccounts: number;
        pastDueAccounts: number;
      };

      // 1999 monthly + round(49900 / 12) = 1999 + 4158.
      expect(body.mrrCents).toBe(1999 + Math.round(49900 / 12));
      expect(body.payingAccounts).toBe(2);
      expect(body.trialingAccounts).toBe(1);
      expect(body.pastDueAccounts).toBe(1);
    });

    it("renders zero rather than NaN on an empty platform", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/metrics");
      const body = (await response.json()) as {
        paidConversion: number;
        churn30d: number;
        mrrCents: number;
      };

      expect(body.paidConversion).toBe(0);
      expect(body.churn30d).toBe(0);
      expect(body.mrrCents).toBe(0);
    });

    it("returns a full calendar, including the days nobody walked in", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request(
        "/api/admin/metrics/stamps-by-day?days=7",
      );
      const body = (await response.json()) as { day: string; count: number }[];

      expect(body).toHaveLength(7);
      expect(body.every((bucket) => bucket.count === 0)).toBe(true);
    });
  });

  describe("saúde", () => {
    it("reports the migration state and a measured latency", async () => {
      const admin = await createPlatformAdmin();
      mockAuthenticatedSession(admin);
      const { app } = createApp();

      const response = await app.request("/api/admin/health");
      const body = (await response.json()) as {
        lastMigrationHash: string | null;
        databaseLatencyMs: number;
        webhookFailures24h: number;
        lastStripeEventAt: string | null;
      };

      expect(response.status).toBe(200);
      expect(body.lastMigrationHash).toBeTruthy();
      expect(body.databaseLatencyMs).toBeGreaterThanOrEqual(0);
      expect(body.webhookFailures24h).toBe(0);
      expect(body.lastStripeEventAt).toBeNull();
    });
  });

  describe("bootstrap do primeiro admin", () => {
    const ENV_KEY = "FIDELIDADE_PLATFORM_ADMIN_EMAIL";

    afterEach(() => {
      delete process.env[ENV_KEY];
    });

    it("promotes the named account when nobody administers yet", async () => {
      const user = await createUser();
      process.env[ENV_KEY] = user.email;

      await ensurePlatformAdminBootstrap();

      const rows = await db
        .select()
        .from(platformAdminTable)
        .where(eq(platformAdminTable.userId, user.id));

      expect(rows).toHaveLength(1);

      const log = await db
        .select()
        .from(adminAuditLogTable)
        .where(eq(adminAuditLogTable.action, "admin.bootstrap"));

      expect(log).toHaveLength(1);
    });

    /**
     * The condition that keeps the variable from being a permanent back door:
     * once anybody administers, setting it does nothing at all.
     */
    it("does nothing once a live grant already exists", async () => {
      await createPlatformAdmin();
      const latecomer = await createUser();
      process.env[ENV_KEY] = latecomer.email;

      await ensurePlatformAdminBootstrap();

      const rows = await db
        .select()
        .from(platformAdminTable)
        .where(eq(platformAdminTable.userId, latecomer.id));

      expect(rows).toHaveLength(0);
    });

    it("is a no-op, not a crash, for an address with no account", async () => {
      process.env[ENV_KEY] = "ninguem@example.com";

      await expect(ensurePlatformAdminBootstrap()).resolves.toBeUndefined();

      const rows = await db.select().from(platformAdminTable);

      expect(rows).toHaveLength(0);
    });

    it("promotes again after the only admin was revoked", async () => {
      await createPlatformAdmin({ revokedAt: new Date() });
      const successor = await createUser();
      process.env[ENV_KEY] = successor.email;

      await ensurePlatformAdminBootstrap();

      const rows = await db
        .select()
        .from(platformAdminTable)
        .where(eq(platformAdminTable.userId, successor.id));

      expect(rows).toHaveLength(1);
    });
  });
});
