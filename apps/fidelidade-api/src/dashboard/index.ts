import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { dashboardSummarySchema, stampsByDaySchema } from "../schemas";
import { storeAccess } from "../utils/store-access-middleware";
import getDashboardCtrl from "./controllers/get-dashboard";
import getStampsByDayCtrl, {
  DEFAULT_STAMPS_BY_DAY_WINDOW,
} from "./controllers/get-stamps-by-day";

/**
 * The painel. Read-only, and deliberately open to the WHOLE team rather than
 * owner-only: a cashier who can see that the person in front of them is one
 * stamp from a prize is the entire point of the "quase lá" tile.
 */

/** Query params arrive as strings; validate and coerce at the boundary. */
const daysSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,3}$/, "Período inválido"),
    v.transform(Number),
    v.minValue(1, "Período inválido"),
    // Capped so a hand-edited URL cannot ask Postgres for a series of a million
    // rows and hand the result to a phone.
    v.maxValue(90, "Período muito longo"),
  ),
);

const dashboard = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "getDashboard",
      tags: ["Dashboard"],
      description: "Contadores do painel da loja",
      responses: {
        200: {
          description: "Contadores da loja",
          content: {
            "application/json": { schema: resolver(dashboardSummarySchema) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator("query", v.object({ storeId: v.string() })),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const summary = await getDashboardCtrl(storeId);
      return c.json(summary);
    },
  )
  .get(
    "/stamps-by-day",
    describeRoute({
      operationId: "getStampsByDay",
      tags: ["Dashboard"],
      description: "Carimbos por dia, no fuso da loja, incluindo dias sem nada",
      responses: {
        200: {
          description: "Um item por dia do período",
          content: {
            "application/json": { schema: resolver(stampsByDaySchema) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        days: daysSchema,
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { days } = c.req.valid("query");
      const series = await getStampsByDayCtrl(
        storeId,
        days ?? DEFAULT_STAMPS_BY_DAY_WINDOW,
      );
      return c.json(series);
    },
  );

export default dashboard;
