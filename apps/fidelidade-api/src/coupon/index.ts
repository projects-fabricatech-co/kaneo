import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireFeature } from "../plans/require-feature-middleware";
import {
  couponRedemptionWithCustomerSchema,
  couponSchema,
  couponStatusSchema,
  discountTypeSchema,
  discountValueSchema,
  maxRedemptionsSchema,
  nullableInstantSchema,
  redemptionValidityDaysSchema,
} from "../schemas";
import { requireStoreRole } from "../utils/require-store-role";
import { storeAccess } from "../utils/store-access-middleware";
import archiveCouponCtrl from "./controllers/archive-coupon";
import createCouponCtrl from "./controllers/create-coupon";
import getCouponCtrl from "./controllers/get-coupon";
import listCouponRedemptionsCtrl from "./controllers/list-coupon-redemptions";
import listCouponsCtrl from "./controllers/list-coupons";
import updateCouponCtrl from "./controllers/update-coupon";

/**
 * Discount campaigns: the lojista's side of the one link and one QR that the
 * whole neighbourhood scans.
 *
 * Reads are open to the team — a cashier needs to see what is running and who
 * claimed it. Every WRITE is owner-only AND `requireFeature("coupons")`, so a
 * store on Grátis gets a 402 pointing at the upgrade rather than a silent
 * no-op. The two middlewares run in that order on purpose: not being the owner
 * is answered before "your plan does not include this", because a cashier being
 * told to upgrade the boss's plan is the wrong conversation.
 */
const titleSchema = v.pipe(
  v.string(),
  v.minLength(2, "Título muito curto"),
  v.maxLength(120, "Título muito longo"),
);

const descriptionSchema = v.nullable(
  v.pipe(v.string(), v.maxLength(500, "Descrição muito longa")),
);

const discountLabelSchema = v.nullable(
  v.pipe(v.string(), v.maxLength(60, "Etiqueta muito longa")),
);

const coupon = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listCoupons",
      tags: ["Coupons"],
      description: "Lista as campanhas de cupom da loja",
      responses: {
        200: {
          description: "Campanhas da loja",
          content: {
            "application/json": { schema: resolver(v.array(couponSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        status: v.optional(couponStatusSchema),
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { status } = c.req.valid("query");
      const coupons = await listCouponsCtrl(storeId, { status });
      return c.json(coupons);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createCoupon",
      tags: ["Coupons"],
      description: "Cria uma campanha de cupom",
      responses: {
        200: {
          description: "Campanha criada",
          content: { "application/json": { schema: resolver(couponSchema) } },
        },
        400: { description: "Desconto ou período inválido" },
        402: { description: "Cupons não estão disponíveis neste plano" },
        403: { description: "Ação permitida apenas ao proprietário" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        title: titleSchema,
        description: v.optional(descriptionSchema),
        discountType: discountTypeSchema,
        discountValue: v.optional(v.nullable(discountValueSchema)),
        discountLabel: v.optional(discountLabelSchema),
        status: v.optional(v.picklist(["draft", "active"] as const)),
        startsAt: v.optional(nullableInstantSchema),
        endsAt: v.optional(nullableInstantSchema),
        maxRedemptions: v.optional(v.nullable(maxRedemptionsSchema)),
        redemptionValidityDays: v.optional(redemptionValidityDaysSchema),
      }),
    ),
    storeAccess.fromBody(),
    requireStoreRole("owner"),
    requireFeature("coupons"),
    async (c) => {
      const storeId = c.get("storeId");
      const input = c.req.valid("json");
      const created = await createCouponCtrl(storeId, input);
      return c.json(created);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getCoupon",
      tags: ["Coupons"],
      description: "Detalhes de uma campanha de cupom",
      responses: {
        200: {
          description: "Detalhes da campanha",
          content: { "application/json": { schema: resolver(couponSchema) } },
        },
        404: { description: "Campanha não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCoupon(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const found = await getCouponCtrl(storeId, id);
      return c.json(found);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateCoupon",
      tags: ["Coupons"],
      description: "Atualiza uma campanha de cupom",
      responses: {
        200: {
          description: "Campanha atualizada",
          content: { "application/json": { schema: resolver(couponSchema) } },
        },
        400: { description: "Desconto ou período inválido" },
        402: { description: "Cupons não estão disponíveis neste plano" },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Campanha não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        title: v.optional(titleSchema),
        description: v.optional(descriptionSchema),
        discountType: v.optional(discountTypeSchema),
        discountValue: v.optional(v.nullable(discountValueSchema)),
        discountLabel: v.optional(discountLabelSchema),
        status: v.optional(couponStatusSchema),
        startsAt: v.optional(nullableInstantSchema),
        endsAt: v.optional(nullableInstantSchema),
        maxRedemptions: v.optional(v.nullable(maxRedemptionsSchema)),
        redemptionValidityDays: v.optional(redemptionValidityDaysSchema),
      }),
    ),
    storeAccess.fromCoupon(),
    requireStoreRole("owner"),
    requireFeature("coupons"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const updated = await updateCouponCtrl(storeId, id, input);
      return c.json(updated);
    },
  )
  .post(
    "/:id/archive",
    describeRoute({
      operationId: "archiveCoupon",
      tags: ["Coupons"],
      description: "Encerra uma campanha de cupom",
      responses: {
        200: {
          description: "Campanha encerrada",
          content: { "application/json": { schema: resolver(couponSchema) } },
        },
        402: { description: "Cupons não estão disponíveis neste plano" },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Campanha não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCoupon(),
    requireStoreRole("owner"),
    requireFeature("coupons"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const archived = await archiveCouponCtrl(storeId, id);
      return c.json(archived);
    },
  )
  .get(
    "/:id/redemptions",
    describeRoute({
      operationId: "listCouponRedemptions",
      tags: ["Coupons"],
      description: "Quem resgatou o link da campanha",
      responses: {
        200: {
          description: "Resgates da campanha",
          content: {
            "application/json": {
              schema: resolver(v.array(couponRedemptionWithCustomerSchema)),
            },
          },
        },
        404: { description: "Campanha não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCoupon(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const redemptions = await listCouponRedemptionsCtrl(storeId, id);
      return c.json(redemptions);
    },
  );

export default coupon;
