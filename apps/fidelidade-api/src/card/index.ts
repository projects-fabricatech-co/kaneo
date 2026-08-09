import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { cardSchema } from "../schemas";
import { storeAccess } from "../utils/store-access-middleware";
import getCardCtrl from "./controllers/get-card";
import listCardsCtrl from "./controllers/list-cards";

/**
 * Read-only. Cards are created and advanced exclusively by `create-stamp`, so
 * there is no write surface here at all — the counter is derived from the stamp
 * ledger, never set directly.
 */
const card = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listCards",
      tags: ["Cards"],
      description: "Lista os cartões da loja",
      responses: {
        200: {
          description: "Cartões da loja",
          content: {
            "application/json": { schema: resolver(v.array(cardSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        customerId: v.optional(v.string()),
        programId: v.optional(v.string()),
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { customerId, programId } = c.req.valid("query");
      const cards = await listCardsCtrl(storeId, { customerId, programId });
      return c.json(cards);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getCard",
      tags: ["Cards"],
      description: "Detalhes de um cartão",
      responses: {
        200: {
          description: "Detalhes do cartão",
          content: { "application/json": { schema: resolver(cardSchema) } },
        },
        404: { description: "Cartão não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCard(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const found = await getCardCtrl(storeId, id);
      return c.json(found);
    },
  );

export default card;
