import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { publicCardSchema } from "../schemas";
import getPublicCardCtrl from "./controllers/get-public-card";

/**
 * UNAUTHENTICATED. This router is mounted BEFORE the auth gate in `src/index.ts`,
 * which is the only reason it is reachable without a session — and the reason
 * nothing may be added here without deciding, explicitly, that the whole internet
 * may read it.
 */
const publicRoutes = new Hono().get(
  "/card/:token",
  describeRoute({
    operationId: "getPublicCard",
    tags: ["Public"],
    description: "Cartão do cliente, acessível pelo link público",
    responses: {
      200: {
        description: "Cartão do cliente",
        content: {
          "application/json": { schema: resolver(publicCardSchema) },
        },
      },
      404: { description: "Cartão não encontrado" },
    },
  }),
  validator(
    "param",
    v.object({ token: v.pipe(v.string(), v.minLength(1, "Token inválido")) }),
  ),
  async (c) => {
    const { token } = c.req.valid("param");
    const card = await getPublicCardCtrl(token);

    // The URL contains a secret, so no shared cache may keep a copy and no
    // browser may write one to disk.
    c.header("Cache-Control", "no-store, private");

    return c.json(card);
  },
);

export default publicRoutes;
