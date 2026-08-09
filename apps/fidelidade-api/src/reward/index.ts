import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { rewardSchema, rewardStatusSchema } from "../schemas";
import { storeAccess } from "../utils/store-access-middleware";
import listPendingRewardsCtrl from "./controllers/list-pending-rewards";
import listRewardsCtrl from "./controllers/list-rewards";

/**
 * Read-only. Rewards are minted by `create-stamp` and spent by `POST
 * /code/redeem`; nothing may create, edit or delete one through this router,
 * because a prize that can be issued by hand is a prize that can be issued to
 * oneself.
 *
 * Owner AND cashier can read: the cashier is the person at the counter who needs
 * to see what is waiting to be handed over.
 */
const rewardListLimitSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,3}$/, "Limite inválido"),
    v.transform(Number),
    v.minValue(1, "Limite inválido"),
    v.maxValue(200, "Limite muito alto"),
  ),
);

const reward = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listRewards",
      tags: ["Rewards"],
      description: "Lista os prêmios da loja, opcionalmente por situação",
      responses: {
        200: {
          description: "Prêmios da loja",
          content: {
            "application/json": { schema: resolver(v.array(rewardSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        status: v.optional(rewardStatusSchema),
        limit: rewardListLimitSchema,
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { status, limit } = c.req.valid("query");
      const rewards = await listRewardsCtrl(storeId, { status, limit });
      return c.json(rewards);
    },
  )
  .get(
    "/pending",
    describeRoute({
      operationId: "listPendingRewards",
      tags: ["Rewards"],
      description:
        "Prêmios aguardando retirada: pendentes e ainda dentro da validade",
      responses: {
        200: {
          description: "Prêmios aguardando retirada",
          content: {
            "application/json": { schema: resolver(v.array(rewardSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        limit: rewardListLimitSchema,
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { limit } = c.req.valid("query");
      const rewards = await listPendingRewardsCtrl(storeId, limit);
      return c.json(rewards);
    },
  );

export default reward;
