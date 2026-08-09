import type { User } from "better-auth/types";
import { and, eq, isNull } from "drizzle-orm";
import { type Context, Hono, type Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { storeTable } from "../database/schema";
import {
  billingIntervalSchema,
  checkoutSessionSchema,
  mySubscriptionSchema,
  paidPlanIdSchema,
  portalSessionSchema,
} from "../schemas";
import createCheckoutSessionCtrl from "./controllers/create-checkout-session";
import createPortalSessionCtrl from "./controllers/create-portal-session";
import getMySubscriptionCtrl from "./controllers/get-my-subscription";

/**
 * Billing belongs to the ACCOUNT OWNER. `subscriptions.owner_user_id` is unique,
 * so the subscription is a property of the account and not of a store, and
 * somebody who only works a till has nothing to manage here.
 *
 * 403, not 404: the caller is authenticated and there is no id to enumerate — a
 * role violation, which is exactly what 403 is reserved for in this codebase.
 */
async function requireAccountOwner(c: Context, next: Next) {
  const userId = c.get("userId") as string;

  const [owned] = await db
    .select({ id: storeTable.id })
    .from(storeTable)
    .where(
      and(eq(storeTable.ownerUserId, userId), isNull(storeTable.archivedAt)),
    )
    .limit(1);

  if (!owned) {
    throw new HTTPException(403, {
      message: "Ação permitida apenas ao proprietário",
    });
  }

  return next();
}

const billing = new Hono<{
  Variables: {
    user: User | null;
    userId: string;
    userEmail: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "getMySubscription",
      tags: ["Billing"],
      description: "Plano vigente, limites, uso atual e estado da assinatura",
      responses: {
        200: {
          description: "Assinatura da conta",
          content: {
            "application/json": { schema: resolver(mySubscriptionSchema) },
          },
        },
        403: { description: "Somente o proprietário" },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator("query", v.object({ storeId: v.optional(v.string()) })),
    requireAccountOwner,
    async (c) => {
      const userId = c.get("userId");
      const { storeId } = c.req.valid("query");
      const subscription = await getMySubscriptionCtrl(userId, storeId);
      return c.json(subscription);
    },
  )
  .post(
    "/checkout",
    describeRoute({
      operationId: "createCheckoutSession",
      tags: ["Billing"],
      description: "Abre um checkout do Stripe em BRL para o plano escolhido",
      responses: {
        200: {
          description: "URL do checkout",
          content: {
            "application/json": { schema: resolver(checkoutSessionSchema) },
          },
        },
        403: { description: "Somente o proprietário" },
        503: { description: "Pagamentos não configurados" },
      },
    }),
    validator(
      "json",
      v.object({
        plan: paidPlanIdSchema,
        interval: billingIntervalSchema,
      }),
    ),
    requireAccountOwner,
    async (c) => {
      const { plan, interval } = c.req.valid("json");

      // The client picks a plan and an interval, never a price id: mapping the
      // pair to a Stripe price happens server-side, so a hand-edited request
      // cannot subscribe anybody to a price we did not publish.
      const session = await createCheckoutSessionCtrl(
        {
          userId: c.get("userId"),
          email: c.get("userEmail"),
          name: c.get("user")?.name ?? null,
        },
        { plan, interval },
      );

      return c.json(session);
    },
  )
  .post(
    "/portal",
    describeRoute({
      operationId: "createPortalSession",
      tags: ["Billing"],
      description: "Abre o portal de cobrança do Stripe da conta",
      responses: {
        200: {
          description: "URL do portal",
          content: {
            "application/json": { schema: resolver(portalSessionSchema) },
          },
        },
        400: { description: "Conta ainda sem assinatura" },
        403: { description: "Somente o proprietário" },
        503: { description: "Pagamentos não configurados" },
      },
    }),
    requireAccountOwner,
    async (c) => {
      const session = await createPortalSessionCtrl(c.get("userId"));
      return c.json(session);
    },
  );

export default billing;
