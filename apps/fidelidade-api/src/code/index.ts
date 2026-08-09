import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  redeemCodeResultSchema,
  shortCodeSchema,
  validateCodeResultSchema,
} from "../schemas";
import { storeAccess } from "../utils/store-access-middleware";
import redeemCodeCtrl from "./controllers/redeem-code";
import validateCodeCtrl from "./controllers/validate-code";

/**
 * ONE input field on the counter screen. The lojista does not know, and must not
 * have to know, whether the customer is showing a prize code or a coupon code —
 * they type it and the first character routes it.
 *
 * The two verbs are split so that looking is free and giving is deliberate:
 * `/validate` never writes, `/redeem` is the only thing that spends a code.
 *
 * Owner and cashier both, for both verbs. Redemption happens with the customer
 * standing at the counter, and an owner-only rule would mean phoning the boss to
 * hand over a coffee.
 */
const code = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .post(
    "/validate",
    describeRoute({
      operationId: "validateCode",
      tags: ["Codes"],
      description:
        "Consulta um código sem resgatá-lo: o que é, o que vale e se pode ser usado",
      responses: {
        200: {
          description: "O que o código é e em que situação está",
          content: {
            "application/json": {
              schema: resolver(validateCodeResultSchema),
            },
          },
        },
        400: { description: "Código inválido" },
        404: { description: "Código não encontrado nesta loja" },
        501: { description: "Cupons ainda não estão disponíveis" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        code: shortCodeSchema,
      }),
    ),
    storeAccess.fromBody(),
    async (c) => {
      const storeId = c.get("storeId");
      const { code: typed } = c.req.valid("json");
      const result = await validateCodeCtrl(storeId, typed);
      return c.json(result);
    },
  )
  .post(
    "/redeem",
    describeRoute({
      operationId: "redeemCode",
      tags: ["Codes"],
      description:
        "Resgata um código: entrega o prêmio, encerra o cartão e abre o próximo ciclo",
      responses: {
        200: {
          description: "Código resgatado; o próximo cartão já começou",
          content: {
            "application/json": { schema: resolver(redeemCodeResultSchema) },
          },
        },
        400: { description: "Código inválido" },
        404: { description: "Código não encontrado nesta loja" },
        409: { description: "Código já utilizado" },
        410: { description: "Código expirado" },
        501: { description: "Cupons ainda não estão disponíveis" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        code: shortCodeSchema,
      }),
    ),
    storeAccess.fromBody(),
    async (c) => {
      const storeId = c.get("storeId");
      const userId = c.get("userId");
      const { code: typed } = c.req.valid("json");

      const result = await redeemCodeCtrl({
        storeId,
        code: typed,
        redeemedByUserId: userId,
      });

      return c.json(result);
    },
  );

export default code;
