import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCoupon,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

type CouponRow = {
  id: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number | null;
  discountLabel: string;
  publicToken: string;
  status: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  redemptionValidityDays: number;
};

/**
 * The lojista's side of coupons: who may write them, which plans include them,
 * and the cross-field discount rule that a request-body schema cannot express.
 *
 * The public claim path lives in `coupon-claim.test.ts` and the campaign landing
 * page in `public-coupon.test.ts`; nothing here re-tests those.
 */
describe("API integration: coupons", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  function create(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/coupon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /** An owner on a plan that includes coupons — the ordinary happy case. */
  async function paidOwner() {
    const { user, store } = await createStoreOwner({ plan: "essencial" });
    mockAuthenticatedSession(user);
    return { user, store, app: createApp().app };
  }

  describe("creating a campaign", () => {
    it("creates one and derives the label the customer reads", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Semana do Cliente",
        discountType: "percent",
        discountValue: 20,
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as CouponRow;
      expect(body).toMatchObject({
        title: "Semana do Cliente",
        discountType: "percent",
        discountValue: 20,
        discountLabel: "20% OFF",
        // Live the moment it is created: the lojista who filled the form is
        // about to share the link, and a draft state they must remember to flip
        // is a campaign that silently 404s the first person who scans it.
        status: "active",
        redemptionCount: 0,
        maxRedemptions: null,
      });
      expect(body.publicToken).toBeTruthy();
    });

    it("mints a distinct public token per campaign", async () => {
      // The token IS the campaign's address. Two campaigns sharing one would
      // point both QRs at whichever row was found first.
      const { store, app } = await paidOwner();

      const first = (await (
        await create(app, {
          storeId: store.id,
          title: "Campanha A",
          discountType: "freebie",
        })
      ).json()) as CouponRow;
      const second = (await (
        await create(app, {
          storeId: store.id,
          title: "Campanha B",
          discountType: "freebie",
        })
      ).json()) as CouponRow;

      expect(first.publicToken).not.toBe(second.publicToken);
    });

    it("formats a centavos discount into reais for the label", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "R$ 15 OFF",
        discountType: "amount",
        discountValue: 1550,
      });

      const body = (await response.json()) as CouponRow;
      expect(body.discountLabel).toBe("R$ 15,50 OFF");
    });

    it("keeps a label the lojista wrote instead of deriving one", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Leve 3 pague 2",
        discountType: "freebie",
        discountLabel: "Leve 3, pague 2",
      });

      const body = (await response.json()) as CouponRow;
      expect(body.discountLabel).toBe("Leve 3, pague 2");
      expect(body.discountValue).toBeNull();
    });
  });

  describe("the discount rule", () => {
    it("rejects a percentage above 100", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Desconto impossível",
        discountType: "percent",
        discountValue: 150,
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("1% a 100%");
    });

    it("rejects a freebie that carries a value", async () => {
      // Silently dropping the number would leave the lojista believing they
      // configured a discount the counter will never honour.
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Brinde",
        discountType: "freebie",
        discountValue: 10,
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("brinde não tem valor");
    });

    it("rejects a percent or amount with no value at all", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Sem valor",
        discountType: "percent",
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("Informe o valor do desconto");
    });

    it("rejects an end date that is not after the start date", async () => {
      const { store, app } = await paidOwner();
      const day = new Date("2026-09-01T12:00:00.000Z");

      const response = await create(app, {
        storeId: store.id,
        title: "Janela invertida",
        discountType: "freebie",
        startsAt: day.toISOString(),
        endsAt: new Date(day.getTime() - 1000).toISOString(),
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("depois da data de início");
    });

    it("re-derives a stale label when the discount itself moves", async () => {
      const { store, app } = await paidOwner();
      const created = (await (
        await create(app, {
          storeId: store.id,
          title: "Semana do Cliente",
          discountType: "percent",
          discountValue: 20,
        })
      ).json()) as CouponRow;
      expect(created.discountLabel).toBe("20% OFF");

      const response = await app.request(`/api/coupon/${created.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discountValue: 30 }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as CouponRow;
      expect(body.discountLabel).toBe("30% OFF");
    });

    it("applies the rule to the MERGE of the stored row and a partial update", async () => {
      // Switching an existing percent campaign to a freebie leaves 20 behind in
      // the column. A body-only schema cannot see that; `resolveDiscount` can.
      const { store, app } = await paidOwner();
      const coupon = await createCoupon(store.id, {
        discountType: "percent",
        discountValue: 20,
      });

      const response = await app.request(`/api/coupon/${coupon.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discountType: "freebie" }),
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("brinde não tem valor");
    });
  });

  describe("who may write", () => {
    it("refuses a cashier and says so as a role problem, not a plan one", async () => {
      // Order matters: `requireStoreRole` runs before `requireFeature`, because
      // telling a cashier to upgrade the boss's plan is the wrong conversation.
      const { store } = await createStoreOwner({ plan: "essencial" });
      const cashier = await createStoreCashier(store.id);
      mockAuthenticatedSession(cashier);
      const { app } = createApp();

      const response = await create(app, {
        storeId: store.id,
        title: "Campanha do caixa",
        discountType: "freebie",
      });

      expect(response.status).toBe(403);
    });

    it("lets a cashier READ the campaigns they have to honour", async () => {
      const { store } = await createStoreOwner({ plan: "essencial" });
      await createCoupon(store.id, { title: "Semana do Cliente" });
      const cashier = await createStoreCashier(store.id);
      mockAuthenticatedSession(cashier);
      const { app } = createApp();

      const response = await app.request(`/api/coupon?storeId=${store.id}`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as CouponRow[];
      expect(body).toHaveLength(1);
      expect(body[0]?.title).toBe("Semana do Cliente");
    });

    it("404s another store's campaign instead of confirming it exists", async () => {
      const { store: theirs } = await createStoreOwner({ plan: "essencial" });
      const theirCoupon = await createCoupon(theirs.id);
      const { user: outsider } = await createStoreOwner({ plan: "essencial" });
      mockAuthenticatedSession(outsider);
      const { app } = createApp();

      const response = await app.request(`/api/coupon/${theirCoupon.id}`);

      expect(response.status).toBe(404);
    });

    it("does not list another store's campaigns", async () => {
      const { store: theirs } = await createStoreOwner({ plan: "essencial" });
      await createCoupon(theirs.id, { title: "Campanha alheia" });
      const { user: outsider, store: mine } = await createStoreOwner({
        plan: "essencial",
      });
      mockAuthenticatedSession(outsider);
      const { app } = createApp();

      const response = await app.request(`/api/coupon?storeId=${mine.id}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });
  });

  describe("the plan gate", () => {
    it("answers 402 with a machine-readable body on Grátis", async () => {
      const { user, store } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await create(app, {
        storeId: store.id,
        title: "Campanha bloqueada",
        discountType: "freebie",
      });

      expect(response.status).toBe(402);
      const body = (await response.json()) as {
        error: string;
        limit: string;
        plan: string;
        message: string;
      };
      // JSON, not the plain text an HTTPException message renders as: the web
      // app opens the upgrade screen off `error`, not off a string match.
      expect(body.error).toBe("plan_feature_unavailable");
      expect(body.limit).toBe("coupons");
      expect(body.plan).toBe("gratis");
      expect(body.message).toBeTruthy();
    });

    it("writes nothing when the plan gate refuses", async () => {
      const { user, store } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      await create(app, {
        storeId: store.id,
        title: "Campanha bloqueada",
        discountType: "freebie",
      });

      const rows = await db
        .select()
        .from(schema.couponTable)
        .where(eq(schema.couponTable.storeId, store.id));
      expect(rows).toHaveLength(0);
    });

    it("still LISTS campaigns on Grátis, so a downgrade does not hide them", async () => {
      const { user, store } = await createStoreOwner();
      await createCoupon(store.id, { title: "Criada quando havia plano" });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await app.request(`/api/coupon?storeId=${store.id}`);

      expect(response.status).toBe(200);
      expect((await response.json()) as CouponRow[]).toHaveLength(1);
    });

    it("allows it on Essencial", async () => {
      const { store, app } = await paidOwner();

      const response = await create(app, {
        storeId: store.id,
        title: "Semana do Cliente",
        discountType: "freebie",
      });

      expect(response.status).toBe(200);
    });

    it("allows it on Pro", async () => {
      const { user, store } = await createStoreOwner({ plan: "pro" });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await create(app, {
        storeId: store.id,
        title: "Semana do Cliente",
        discountType: "freebie",
      });

      expect(response.status).toBe(200);
    });

    it("refuses to archive on Grátis too, not only to create", async () => {
      const { user, store } = await createStoreOwner();
      const coupon = await createCoupon(store.id);
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await app.request(`/api/coupon/${coupon.id}/archive`, {
        method: "POST",
      });

      expect(response.status).toBe(402);
    });
  });

  describe("archiving", () => {
    it("marks the campaign archived, which takes the public link down", async () => {
      const { store, app } = await paidOwner();
      const coupon = await createCoupon(store.id, { status: "active" });

      const response = await app.request(`/api/coupon/${coupon.id}/archive`, {
        method: "POST",
      });

      expect(response.status).toBe(200);
      expect(((await response.json()) as CouponRow).status).toBe("archived");

      const landing = await app.request(
        `/api/public/coupon/${coupon.publicToken}`,
      );
      expect(landing.status).toBe(404);
    });
  });
});
