import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  adminIdentitySchema,
  auditLogPageSchema,
  platformHealthSchema,
  platformMetricsSchema,
  platformStampsByDaySchema,
} from "../schemas";
import getPlatformHealthCtrl from "./controllers/get-platform-health";
import getPlatformMetricsCtrl from "./controllers/get-platform-metrics";
import getPlatformStampsByDayCtrl, {
  DEFAULT_PLATFORM_WINDOW,
} from "./controllers/get-platform-stamps-by-day";
import listAuditLogCtrl from "./controllers/list-audit-log";
import { recordFromContext } from "./record-admin-action";
import { requirePlatformAdmin } from "./require-platform-admin";

/**
 * The owner's console.
 *
 * Mounted in `src/index.ts` AFTER the auth gate, and every route below is
 * additionally behind `requirePlatformAdmin()` — a signed-in lojista who guesses
 * the path gets the same 404 as somebody who guessed a store id.
 *
 * Every handler records what it did before it does it. Nothing here reads an
 * individual customer's data yet, so nothing here mounts `requireAdminReason()`;
 * the first route that reads a person's row is phase B's, and it composes the
 * two together.
 */

/** Query params arrive as strings; validate and coerce at the boundary. */
const daysSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,3}$/, "Período inválido"),
    v.transform(Number),
    v.minValue(1, "Período inválido"),
    v.maxValue(90, "Período muito longo"),
  ),
);

const pageSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,4}$/, "Página inválida"),
    v.transform(Number),
    v.maxValue(1000, "Página muito distante"),
  ),
);

const admin = new Hono<{
  Variables: {
    userId: string;
    adminUserId: string;
    adminEmail: string;
    adminReason: string;
  };
}>()
  .use("*", requirePlatformAdmin())
  .get(
    "/me",
    describeRoute({
      operationId: "getAdminIdentity",
      tags: ["Admin"],
      description: "Confirma que quem chama administra a plataforma",
      responses: {
        200: {
          description: "É administrador",
          content: {
            "application/json": { schema: resolver(adminIdentitySchema) },
          },
        },
        404: { description: "Não é administrador" },
      },
    }),
    // Not logged. This fires on every console page load to decide whether the
    // shell renders at all; logging it would bury the reads that matter under
    // thousands of rows saying somebody opened a page.
    (c) => c.json({ email: c.get("adminEmail") }),
  )
  .get(
    "/metrics",
    describeRoute({
      operationId: "getPlatformMetrics",
      tags: ["Admin"],
      description: "Contadores de negócio da plataforma inteira",
      responses: {
        200: {
          description: "Métricas da plataforma",
          content: {
            "application/json": { schema: resolver(platformMetricsSchema) },
          },
        },
        404: { description: "Não é administrador" },
      },
    }),
    async (c) => {
      await recordFromContext(c, { action: "admin.metrics.read" });
      const metrics = await getPlatformMetricsCtrl();
      return c.json(metrics);
    },
  )
  .get(
    "/metrics/stamps-by-day",
    describeRoute({
      operationId: "getPlatformStampsByDay",
      tags: ["Admin"],
      description: "Carimbos por dia em todas as lojas, no fuso da plataforma",
      responses: {
        200: {
          description: "Um item por dia do período",
          content: {
            "application/json": {
              schema: resolver(platformStampsByDaySchema),
            },
          },
        },
        404: { description: "Não é administrador" },
      },
    }),
    validator("query", v.object({ days: daysSchema })),
    async (c) => {
      const { days } = c.req.valid("query");
      const series = await getPlatformStampsByDayCtrl(
        days ?? DEFAULT_PLATFORM_WINDOW,
      );
      return c.json(series);
    },
  )
  .get(
    "/health",
    describeRoute({
      operationId: "getPlatformHealth",
      tags: ["Admin"],
      description: "Stripe, webhooks, migração aplicada e latência do banco",
      responses: {
        200: {
          description: "Estado do sistema",
          content: {
            "application/json": { schema: resolver(platformHealthSchema) },
          },
        },
        404: { description: "Não é administrador" },
      },
    }),
    async (c) => {
      const health = await getPlatformHealthCtrl();
      return c.json(health);
    },
  )
  .get(
    "/audit",
    describeRoute({
      operationId: "listAdminAuditLog",
      tags: ["Admin"],
      description: "O log de auditoria, mais recente primeiro",
      responses: {
        200: {
          description: "Uma página do log",
          content: {
            "application/json": { schema: resolver(auditLogPageSchema) },
          },
        },
        404: { description: "Não é administrador" },
      },
    }),
    validator("query", v.object({ page: pageSchema })),
    async (c) => {
      const { page } = c.req.valid("query");
      // Reading the log is itself an administrative act, and one worth seeing in
      // the log: "who has been checking what everyone else did" is a question
      // the log exists to answer about itself.
      await recordFromContext(c, { action: "admin.audit.read" });
      const entries = await listAuditLogCtrl(page ?? 0);
      return c.json(entries);
    },
  );

export default admin;
