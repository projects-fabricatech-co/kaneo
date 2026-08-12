import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  stampResultSchema,
  stampSchema,
  stampSourceSchema,
  voidStampResultSchema,
} from "../schemas";
import { requireStoreRole } from "../utils/require-store-role";
import { storeAccess } from "../utils/store-access-middleware";
import createStampCtrl from "./controllers/create-stamp";
import createStampByTokenCtrl from "./controllers/create-stamp-by-token";
import listStampsCtrl from "./controllers/list-stamps";
import voidStampCtrl from "./controllers/void-stamp";

/**
 * A UUID and REQUIRED, not optional. The column is nullable only so seeds and
 * imports can exist; every stamp that comes in over HTTP carries a key, because
 * that key is the only thing that makes the button on a cashier's phone safe to
 * press twice on a bad connection.
 */
const idempotencyKeySchema = v.pipe(
  v.string(),
  v.uuid("Chave de idempotência inválida"),
);

const stampHistoryLimitSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,3}$/, "Limite inválido"),
    v.transform(Number),
    v.minValue(1, "Limite inválido"),
    v.maxValue(200, "Limite muito alto"),
  ),
);

/**
 * Both stamp routes sit behind the auth gate AND a `storeAccess` middleware, so
 * an authenticated member of the store is always the actor. A customer's public
 * token is an identifier, never a credential — it can select who gets the stamp
 * and nothing else.
 */
const stamp = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listStamps",
      tags: ["Stamps"],
      description: "Histórico de carimbos, incluindo os cancelados",
      responses: {
        200: {
          description: "Carimbos",
          content: {
            "application/json": { schema: resolver(v.array(stampSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        cardId: v.optional(v.string()),
        customerId: v.optional(v.string()),
        limit: stampHistoryLimitSchema,
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { cardId, customerId, limit } = c.req.valid("query");
      const stamps = await listStampsCtrl(storeId, {
        cardId,
        customerId,
        limit,
      });
      return c.json(stamps);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createStamp",
      tags: ["Stamps"],
      description: "Carimba o cartão de um cliente",
      responses: {
        200: {
          description:
            "Carimbo registrado, ou o estado atual quando a chave de idempotência já havia sido usada",
          content: {
            "application/json": { schema: resolver(stampResultSchema) },
          },
        },
        404: { description: "Programa ou cliente não encontrado" },
        409: { description: "Cartão completo" },
        429: { description: "Intervalo entre carimbos não respeitado" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        programId: v.string(),
        customerId: v.string(),
        idempotencyKey: idempotencyKeySchema,
        source: v.optional(stampSourceSchema, "manual"),
      }),
    ),
    storeAccess.fromBody(),
    async (c) => {
      const storeId = c.get("storeId");
      const userId = c.get("userId");
      const { programId, customerId, idempotencyKey, source } =
        c.req.valid("json");

      const result = await createStampCtrl({
        storeId,
        programId,
        customerId,
        idempotencyKey,
        source,
        createdByUserId: userId,
      });

      return c.json(result);
    },
  )
  .post(
    "/by-token",
    describeRoute({
      operationId: "createStampByToken",
      tags: ["Stamps"],
      description: "Carimba o cartão identificado pelo QR Code do cliente",
      responses: {
        200: {
          description:
            "Carimbo registrado, ou o estado atual quando a chave de idempotência já havia sido usada",
          content: {
            "application/json": { schema: resolver(stampResultSchema) },
          },
        },
        404: { description: "Programa ou cliente não encontrado" },
        409: { description: "Cartão completo" },
        429: { description: "Intervalo entre carimbos não respeitado" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        programId: v.string(),
        token: v.pipe(v.string(), v.minLength(1, "Token inválido")),
        idempotencyKey: idempotencyKeySchema,
        source: v.optional(stampSourceSchema, "qr"),
      }),
    ),
    storeAccess.fromBody(),
    async (c) => {
      const storeId = c.get("storeId");
      const userId = c.get("userId");
      const { programId, token, idempotencyKey, source } = c.req.valid("json");

      const result = await createStampByTokenCtrl({
        storeId,
        programId,
        token,
        idempotencyKey,
        source,
        createdByUserId: userId,
      });

      return c.json(result);
    },
  )
  .post(
    "/:id/void",
    describeRoute({
      operationId: "voidStamp",
      tags: ["Stamps"],
      description: "Cancela um carimbo e devolve o contador do cartão",
      responses: {
        200: {
          description: "Carimbo cancelado",
          content: {
            "application/json": { schema: resolver(voidStampResultSchema) },
          },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Carimbo não encontrado" },
        409: { description: "Carimbo já cancelado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromStamp(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const userId = c.get("userId");
      const { id } = c.req.valid("param");
      const result = await voidStampCtrl(storeId, id, userId);
      return c.json(result);
    },
  );

export default stamp;
