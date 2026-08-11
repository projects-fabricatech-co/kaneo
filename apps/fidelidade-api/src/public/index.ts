import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  claimPublicCouponSchema,
  publicCardSchema,
  publicCouponSchema,
} from "../schemas";
import { claimClientIp, consumeClaimAttempt } from "./claim-rate-limit";
import claimPublicCouponCtrl from "./controllers/claim-public-coupon";
import getPublicCardCtrl from "./controllers/get-public-card";
import getPublicCouponCtrl from "./controllers/get-public-coupon";

/**
 * UNAUTHENTICATED. This router is mounted BEFORE the auth gate in `src/index.ts`,
 * which is the only reason it is reachable without a session — and the reason
 * nothing may be added here without deciding, explicitly, that the whole internet
 * may read it.
 *
 * One route here also WRITES: `POST /coupon/:token/claim`, the single
 * unauthenticated write in the product. Its safety is structural — a guarded
 * conditional UPDATE for the campaign cap and a unique index for one-code-per-
 * person — with an in-memory rate limit in front to dampen abuse. Read
 * `controllers/claim-public-coupon.ts` before touching it.
 */
const tokenSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1, "Token inválido")),
});

const publicRoutes = new Hono()
  .get(
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
    validator("param", tokenSchema),
    async (c) => {
      const { token } = c.req.valid("param");
      const card = await getPublicCardCtrl(token);

      // The URL contains a secret, so no shared cache may keep a copy and no
      // browser may write one to disk.
      c.header("Cache-Control", "no-store, private");

      return c.json(card);
    },
  )
  .get(
    "/coupon/:token",
    describeRoute({
      operationId: "getPublicCoupon",
      tags: ["Public"],
      description: "Campanha de cupom, acessível pelo link público",
      responses: {
        200: {
          description: "Campanha em cartaz",
          content: {
            "application/json": { schema: resolver(publicCouponSchema) },
          },
        },
        404: { description: "Campanha não encontrada" },
      },
    }),
    validator("param", tokenSchema),
    async (c) => {
      const { token } = c.req.valid("param");
      const campaign = await getPublicCouponCtrl(token);

      // Not a secret — this link is printed on a poster — but `soldOut` flips
      // without warning, and a cached "ainda dá tempo" is a person walking in
      // to be refused.
      c.header("Cache-Control", "no-store");

      return c.json(campaign);
    },
  )
  .post(
    "/coupon/:token/claim",
    describeRoute({
      operationId: "claimPublicCoupon",
      tags: ["Public"],
      description:
        "Gera o cupom pessoal do cliente e o cadastra na base da loja",
      responses: {
        200: {
          description: "Cupom pessoal do cliente",
          content: {
            "application/json": { schema: resolver(claimPublicCouponSchema) },
          },
        },
        402: { description: "Limite de clientes do plano atingido" },
        404: { description: "Campanha não encontrada" },
        409: { description: "Cupom esgotado" },
        422: { description: "Telefone inválido" },
        429: { description: "Muitas tentativas" },
      },
    }),
    validator("param", tokenSchema),
    validator(
      "json",
      v.object({
        // Capped: no BR phone spelling exceeds this, and the field sits on the
        // one unauthenticated write in the product.
        phone: v.pipe(
          v.string(),
          v.minLength(1, "Informe o telefone"),
          v.maxLength(32, "Telefone inválido"),
        ),
        name: v.optional(
          v.nullable(v.pipe(v.string(), v.maxLength(120, "Nome muito longo"))),
        ),
      }),
    ),
    async (c) => {
      const { token } = c.req.valid("param");
      const { phone, name } = c.req.valid("json");

      // Before any database work: a flood costs two hashes. The phone is the
      // primary axis — see the module comment for why keying on IP alone turned
      // this into a denial of service against ordinary customers.
      consumeClaimAttempt(claimClientIp(c), token, phone);
      const claimed = await claimPublicCouponCtrl(token, { phone, name });

      // The response carries the customer's own card link, which IS a secret.
      c.header("Cache-Control", "no-store, private");

      return c.json(claimed);
    },
  );

export default publicRoutes;
