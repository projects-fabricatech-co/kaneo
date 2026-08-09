import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCard,
  createCoupon,
  createCouponRedemption,
  createCustomer,
  createProgram,
  createRewardWithCard,
  createStamp,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

type CustomerHistory = {
  customer: { id: string; name: string | null; phone: string };
  cards: Array<{
    id: string;
    programId: string;
    programName: string;
    cycle: number;
    stampsCount: number;
    stampsRequired: number;
    status: string;
    completedAt: string | null;
    redeemedAt: string | null;
  }>;
  rewards: Array<{
    id: string;
    code: string;
    description: string;
    status: string;
    expiresAt: string | null;
    redeemedAt: string | null;
  }>;
  coupons: Array<{
    id: string;
    couponId: string;
    code: string;
    title: string;
    discountLabel: string;
    status: string;
    expiresAt: string | null;
    redeemedAt: string | null;
  }>;
  totals: {
    totalStamps: number;
    totalRewards: number;
    totalRedeemed: number;
  };
};

/**
 * The sheet that opens when the lojista taps a name at the counter: every cycle
 * the person has filled, every prize they hold, every campaign code they claimed
 * — and none of it belonging to anybody else.
 */
describe("API integration: customer history", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  /**
   * A cycle that is over: the card was filled and the prize handed across the
   * counter. Left in `redeemed` rather than `completed` because
   * `cards_program_customer_live_unique` allows a customer exactly one live card
   * per program — which is the real rule, and the reason a customer can have
   * more than one cycle on the same program at all.
   */
  async function closeCycle(
    storeId: string,
    programId: string,
    customerId: string,
  ) {
    const redeemedAt = new Date();
    const { card, reward } = await createRewardWithCard(
      storeId,
      programId,
      customerId,
      { status: "redeemed", redeemedAt },
    );

    await db
      .update(schema.cardTable)
      .set({ status: "redeemed", redeemedAt })
      .where(eq(schema.cardTable.id, card.id));

    return { card, reward };
  }

  function history(
    app: ReturnType<typeof createApp>["app"],
    customerId: string,
  ): Promise<Response> {
    return app.request(`/api/customer/${customerId}/history`);
  }

  async function ownerOf() {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    return { user, store, app: createApp().app };
  }

  it("returns the cycles, the prizes and the campaign codes, newest first", async () => {
    const { store, app } = await ownerOf();
    const cafe = await createProgram(store.id, {
      name: "Cartão do Café",
      stampsRequired: 10,
    });
    const almoco = await createProgram(store.id, { name: "Cartão do Almoço" });
    const customer = await createCustomer(store.id, { name: "Ana" });

    const { card: past } = await closeCycle(store.id, cafe.id, customer.id);
    const { card: full } = await createRewardWithCard(
      store.id,
      cafe.id,
      customer.id,
    );
    const live = await createCard(store.id, almoco.id, customer.id, {
      stampsCount: 3,
      stampsRequired: 10,
    });

    const coupon = await createCoupon(store.id, {
      title: "Semana do Cliente",
      discountLabel: "20% OFF",
    });
    await createCouponRedemption(store.id, coupon.id, customer.id);

    const response = await history(app, customer.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as CustomerHistory;

    expect(body.customer).toMatchObject({
      id: customer.id,
      name: "Ana",
      phone: customer.phone,
    });

    expect(body.cards.map((card) => card.id)).toEqual([
      live.id,
      full.id,
      past.id,
    ]);
    expect(body.cards[0]).toMatchObject({
      programId: almoco.id,
      programName: "Cartão do Almoço",
      cycle: 1,
      stampsCount: 3,
      stampsRequired: 10,
      status: "active",
      completedAt: null,
    });
    expect(body.cards[1]).toMatchObject({
      programName: "Cartão do Café",
      cycle: 2,
      status: "completed",
    });
    expect(body.cards[1]?.completedAt).not.toBeNull();
    expect(body.cards[2]).toMatchObject({ cycle: 1, status: "redeemed" });

    expect(body.rewards).toHaveLength(2);
    expect(body.rewards.map((reward) => reward.status)).toEqual([
      "pending",
      "redeemed",
    ]);
    expect(body.rewards.every((reward) => reward.code.length > 0)).toBe(true);
    expect(body.rewards[0]?.description).toBe("Um café grátis");

    expect(body.coupons).toHaveLength(1);
    expect(body.coupons[0]).toMatchObject({
      couponId: coupon.id,
      title: "Semana do Cliente",
      discountLabel: "20% OFF",
      status: "pending",
    });
    expect(body.coupons[0]?.code.length).toBeGreaterThan(0);
  });

  it("totals the stamps, the prizes and the ones actually collected", async () => {
    const { store, app } = await ownerOf();
    const cafe = await createProgram(store.id);
    const almoco = await createProgram(store.id);
    const customer = await createCustomer(store.id);

    const card = await createCard(store.id, almoco.id, customer.id);
    await createStamp(card);
    await createStamp(card);
    // A cancelled stamp was undone at the counter and the card was decremented
    // with it; counting it here would contradict the card on the same screen.
    await createStamp(card, { voidedAt: new Date() });

    await closeCycle(store.id, cafe.id, customer.id);
    await createRewardWithCard(store.id, cafe.id, customer.id);

    const body = (await (
      await history(app, customer.id)
    ).json()) as CustomerHistory;

    expect(body.totals).toEqual({
      totalStamps: 2,
      totalRewards: 2,
      totalRedeemed: 1,
    });
  });

  it("shows a brand-new customer as empty lists and zeros", async () => {
    // Zeros, not nulls and not a 404: somebody who was enrolled a minute ago has
    // a history, it is simply empty.
    const { store, app } = await ownerOf();
    const customer = await createCustomer(store.id);

    const body = (await (
      await history(app, customer.id)
    ).json()) as CustomerHistory;

    expect(body.cards).toEqual([]);
    expect(body.rewards).toEqual([]);
    expect(body.coupons).toEqual([]);
    expect(body.totals).toEqual({
      totalStamps: 0,
      totalRewards: 0,
      totalRedeemed: 0,
    });
  });

  it("never mixes in another customer of the same store", async () => {
    const { store, app } = await ownerOf();
    const cafe = await createProgram(store.id);
    const almoco = await createProgram(store.id);
    const mine = await createCustomer(store.id);
    const other = await createCustomer(store.id);

    const card = await createCard(store.id, cafe.id, mine.id);
    await createStamp(card);

    const otherCard = await createCard(store.id, cafe.id, other.id, {
      stampsCount: 5,
    });
    await createStamp(otherCard);
    await createStamp(otherCard);
    await createRewardWithCard(store.id, almoco.id, other.id);

    const coupon = await createCoupon(store.id);
    await createCouponRedemption(store.id, coupon.id, other.id);

    const body = (await (
      await history(app, mine.id)
    ).json()) as CustomerHistory;

    expect(body.cards.map((entry) => entry.id)).toEqual([card.id]);
    expect(body.rewards).toEqual([]);
    expect(body.coupons).toEqual([]);
    expect(body.totals.totalStamps).toBe(1);
  });

  it("404s another store's customer instead of confirming they exist", async () => {
    // 404 and not 403: a 403 would tell an outsider that the id they hold is a
    // real person somewhere in the system.
    const { store: theirs } = await createStoreOwner();
    const theirCustomer = await createCustomer(theirs.id, { name: "Alheia" });
    const { user: outsider } = await createStoreOwner();
    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await history(app, theirCustomer.id);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Alheia");
  });

  it("404s an id that belongs to nobody", async () => {
    const { app } = await ownerOf();

    const response = await history(app, "nao-existe");

    expect(response.status).toBe(404);
  });

  it("lets a cashier read it — the customer is standing right there", async () => {
    const { store } = await createStoreOwner();
    const program = await createProgram(store.id);
    const customer = await createCustomer(store.id, { name: "Bruno" });
    const card = await createCard(store.id, program.id, customer.id, {
      stampsCount: 9,
    });
    await createStamp(card);

    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await history(app, customer.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as CustomerHistory;
    expect(body.customer.name).toBe("Bruno");
    expect(body.totals.totalStamps).toBe(1);
  });
});
