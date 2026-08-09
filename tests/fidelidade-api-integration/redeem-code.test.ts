import { and, count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCoupon,
  createCouponRedemption,
  createCustomer,
  createProgram,
  createRewardWithCard,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

/**
 * Redemption is the moment money leaves the shop. It has to happen exactly once
 * per code, with the customer standing at the counter and two members of staff
 * plausibly scanning the same phone screen at the same second.
 *
 * There is no lock and no read-before-write here by design: a single conditional
 * UPDATE is the arbiter. These tests run real concurrent requests against real
 * Postgres, which is the only way that claim is worth anything.
 */
describe("API integration: redeeming a code", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed(
    programOverrides: Partial<Parameters<typeof createProgram>[1]> = {},
  ) {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id, {
      stampsRequired: 3,
      cooldownMinutes: 0,
      rewardDescription: "Um café grátis",
      ...programOverrides,
    });
    const customer = await createCustomer(store.id, { name: "Joana" });
    const { card, reward } = await createRewardWithCard(
      store.id,
      program.id,
      customer.id,
      { description: program.rewardDescription },
    );

    mockAuthenticatedSession(user);

    return { user, store, program, customer, card, reward };
  }

  /**
   * A second reward in the same store needs a second customer:
   * `cards_program_customer_live_unique` allows one live card per person per
   * program, which is the invariant, not an inconvenience.
   */
  async function anotherReward(
    storeId: string,
    programId: string,
    overrides: Parameters<typeof createRewardWithCard>[3] = {},
  ) {
    const customer = await createCustomer(storeId, { name: "Outro cliente" });
    return createRewardWithCard(storeId, programId, customer.id, overrides);
  }

  function redeem(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/code/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("lets exactly one of two simultaneous redemptions of the same code through", async () => {
    // THE test in this file. Both cashiers press "resgatar" on the same code at
    // the same moment; one hands over a coffee and the other is told why not.
    const { store, reward, customer } = await seed();
    const { app } = createApp();

    const responses = await Promise.all([
      redeem(app, { storeId: store.id, code: reward.code }),
      redeem(app, { storeId: store.id, code: reward.code }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(persisted?.status).toBe("redeemed");
    expect(persisted?.redeemedAt).toBeInstanceOf(Date);

    // Redeemed once means the cycle rolled over once: two winners would show up
    // here as a second new card, or as a unique-index error.
    const [cards] = await db
      .select({ value: count() })
      .from(schema.cardTable)
      .where(eq(schema.cardTable.customerId, customer.id));
    expect(Number(cards?.value)).toBe(2);

    const refused = responses.find((response) => response.status === 409);
    const body = (await refused?.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ error: "code_already_redeemed" });
    expect(typeof body.redeemedAt).toBe("string");
    expect(body.message as string).toMatch(/já utilizado/i);
  });

  it("closes the card and opens the next cycle, empty", async () => {
    const { store, program, customer, card, reward } = await seed();
    const { app } = createApp();

    // The owner raised the goal after this card was issued. The card that is
    // closing keeps its snapshot; the NEW cycle takes the current value, because
    // a new cycle is a new agreement.
    await db
      .update(schema.programTable)
      .set({ stampsRequired: 8 })
      .where(eq(schema.programTable.id, program.id));

    const response = await redeem(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      kind: string;
      reward: { id: string; status: string; redeemedAt: string | null };
      card: { id: string; status: string; cycle: number };
      nextCard: {
        id: string;
        status: string;
        cycle: number;
        stampsCount: number;
        stampsRequired: number;
      };
    };

    expect(body.kind).toBe("reward");
    expect(body.reward).toMatchObject({ id: reward.id, status: "redeemed" });
    expect(body.reward.redeemedAt).not.toBeNull();

    expect(body.card).toMatchObject({
      id: card.id,
      status: "redeemed",
      cycle: card.cycle,
    });

    expect(body.nextCard).toMatchObject({
      status: "active",
      cycle: card.cycle + 1,
      stampsCount: 0,
      stampsRequired: 8,
    });
    expect(body.nextCard.id).not.toBe(card.id);

    const closed = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.id, card.id),
    });
    expect(closed?.status).toBe("redeemed");
    expect(closed?.redeemedAt).toBeInstanceOf(Date);
    expect(closed?.stampsRequired).toBe(1);

    // Exactly one live card for this customer: the fresh one.
    const live = await db
      .select()
      .from(schema.cardTable)
      .where(
        and(
          eq(schema.cardTable.customerId, customer.id),
          eq(schema.cardTable.status, "active"),
        ),
      );
    expect(live).toHaveLength(1);
    expect(live[0]?.cycle).toBe(card.cycle + 1);
  });

  it("records who handed the prize over", async () => {
    const { user, store, reward } = await seed();
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: store.id,
      code: reward.code,
    });
    expect(response.status).toBe(200);

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(persisted?.redeemedByUserId).toBe(user.id);
  });

  it("lets a cashier redeem — the customer is standing right there", async () => {
    const { store, program } = await seed();
    const { reward } = await anotherReward(store.id, program.id);

    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(persisted?.redeemedByUserId).toBe(cashier.id);
  });

  it("refuses an expired code with 410 and leaves it untouched", async () => {
    const { store, program } = await seed();
    const { card, reward } = await anotherReward(store.id, program.id, {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(410);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ error: "code_expired" });
    expect(body.message as string).toMatch(/expirado/i);

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(persisted?.status).toBe("pending");
    expect(persisted?.redeemedAt).toBeNull();

    // And no cycle rolled over behind the refusal.
    const closed = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.id, card.id),
    });
    expect(closed?.status).toBe("completed");
  });

  it("honours a code with no expiry at all", async () => {
    const { store, program } = await seed();
    const { reward } = await anotherReward(store.id, program.id, {
      expiresAt: null,
    });
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);
  });

  it("404s a code that does not exist", async () => {
    const { store } = await seed();
    const { app } = createApp();

    const response = await redeem(app, { storeId: store.id, code: "PZZZZZZ" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "code_not_found",
      message: "Código não encontrado",
    });
  });

  it("404s store B's code inside store A, and never spends it", async () => {
    // Cross-tenant. A 409 or a 410 here would confirm the code exists somewhere,
    // and a 200 would let one shop spend another's prize.
    const a = await seed();
    const b = await seed();

    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: a.store.id,
      code: b.reward.code,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "code_not_found",
    });

    const untouched = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, b.reward.id),
    });
    expect(untouched?.status).toBe("pending");
    expect(untouched?.redeemedAt).toBeNull();
  });

  it("404s a store the caller is not a member of, before looking at the code", async () => {
    const a = await seed();
    const b = await seed();

    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: b.store.id,
      code: b.reward.code,
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Loja não encontrada");
  });

  it("rejects a code with an unknown prefix without touching the database", async () => {
    const { store } = await seed();
    const { app } = createApp();

    const response = await redeem(app, { storeId: store.id, code: "XKM4T9" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_code",
    });
  });

  /**
   * `C` codes spend through the same endpoint and the same conditional UPDATE,
   * against `coupon_redemptions` instead of `rewards`. The failure bodies are
   * identical by design: the counter screen must not care which kind was typed.
   */
  describe("coupon codes", () => {
    async function seedCouponCode(
      storeId: string,
      overrides: Parameters<typeof createCouponRedemption>[3] = {},
      couponOverrides: Parameters<typeof createCoupon>[1] = {},
    ) {
      const coupon = await createCoupon(storeId, {
        title: "Semana do Cliente",
        discountLabel: "20% OFF",
        ...couponOverrides,
      });
      const customer = await createCustomer(storeId, { name: "Joana" });
      const redemption = await createCouponRedemption(
        storeId,
        coupon.id,
        customer.id,
        overrides,
      );

      return { coupon, customer, redemption };
    }

    it("spends a coupon code once, and refuses the second attempt", async () => {
      const { user, store } = await createStoreOwner({ plan: "essencial" });
      const { coupon, redemption } = await seedCouponCode(store.id);
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const first = await redeem(app, {
        storeId: store.id,
        code: redemption.code,
      });
      expect(first.status).toBe(200);

      const body = (await first.json()) as {
        kind: string;
        redemption: { id: string; status: string; redeemedAt: string | null };
        coupon: { id: string; discountLabel: string };
      };

      expect(body.kind).toBe("coupon");
      expect(body.redemption).toMatchObject({
        id: redemption.id,
        status: "redeemed",
      });
      expect(body.redemption.redeemedAt).not.toBeNull();
      expect(body.coupon).toMatchObject({
        id: coupon.id,
        discountLabel: "20% OFF",
      });

      const persisted = await db.query.couponRedemptionTable.findFirst({
        where: eq(schema.couponRedemptionTable.id, redemption.id),
      });
      expect(persisted?.status).toBe("redeemed");
      expect(persisted?.redeemedByUserId).toBe(user.id);

      // The campaign's counter is untouched: it counted the code when it was
      // CLAIMED, not when it was spent.
      const campaign = await db.query.couponTable.findFirst({
        where: eq(schema.couponTable.id, coupon.id),
      });
      expect(campaign?.redemptionCount).toBe(1);

      const second = await redeem(app, {
        storeId: store.id,
        code: redemption.code,
      });
      expect(second.status).toBe(409);
      await expect(second.json()).resolves.toMatchObject({
        error: "code_already_redeemed",
      });
    });

    it("lets exactly one of two simultaneous redemptions through", async () => {
      const { user, store } = await createStoreOwner({ plan: "essencial" });
      const { redemption } = await seedCouponCode(store.id);
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const responses = await Promise.all([
        redeem(app, { storeId: store.id, code: redemption.code }),
        redeem(app, { storeId: store.id, code: redemption.code }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409,
      ]);
    });

    it("refuses an expired coupon code with 410 and leaves it pending", async () => {
      const { user, store } = await createStoreOwner({ plan: "essencial" });
      const { redemption } = await seedCouponCode(store.id, {
        expiresAt: new Date(Date.now() - 60_000),
      });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await redeem(app, {
        storeId: store.id,
        code: redemption.code,
      });

      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({
        error: "code_expired",
      });

      const persisted = await db.query.couponRedemptionTable.findFirst({
        where: eq(schema.couponRedemptionTable.id, redemption.id),
      });
      expect(persisted?.status).toBe("pending");
      expect(persisted?.redeemedAt).toBeNull();
    });

    it("404s store B's coupon code inside store A, and never spends it", async () => {
      const a = await createStoreOwner({ plan: "essencial" });
      const b = await createStoreOwner({ plan: "essencial" });
      const { redemption } = await seedCouponCode(b.store.id);

      mockAuthenticatedSession(a.user);
      const { app } = createApp();

      const response = await redeem(app, {
        storeId: a.store.id,
        code: redemption.code,
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "code_not_found",
      });

      const untouched = await db.query.couponRedemptionTable.findFirst({
        where: eq(schema.couponRedemptionTable.id, redemption.id),
      });
      expect(untouched?.status).toBe("pending");
      expect(untouched?.redeemedAt).toBeNull();
    });

    it("404s a coupon code that does not exist", async () => {
      const { user, store } = await createStoreOwner({ plan: "essencial" });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await redeem(app, {
        storeId: store.id,
        code: "CZZZZZZ",
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "code_not_found",
      });
    });
  });

  it("accepts a code typed in lower case, with stray spaces", async () => {
    const { store, reward } = await seed();
    const { app } = createApp();

    const response = await redeem(app, {
      storeId: store.id,
      code: `  ${reward.code.toLowerCase()} `,
    });

    expect(response.status).toBe(200);
  });

  it("refuses a second, sequential redemption with the date of the first", async () => {
    const { store, reward } = await seed();
    const { app } = createApp();

    const first = await redeem(app, { storeId: store.id, code: reward.code });
    expect(first.status).toBe(200);

    const second = await redeem(app, { storeId: store.id, code: reward.code });
    expect(second.status).toBe(409);

    const body = (await second.json()) as Record<string, unknown>;
    expect(body.error).toBe("code_already_redeemed");
    // dd/mm/yyyy hh:mm, in the store's timezone.
    expect(body.message as string).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
