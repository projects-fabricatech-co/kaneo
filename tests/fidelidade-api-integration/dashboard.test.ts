import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCard,
  createCoupon,
  createCustomer,
  createProgram,
  createRewardWithCard,
  createStamp,
  createStoreCashier,
  createStoreOwner,
  localInstant,
} from "./helpers/fixtures";

type DashboardSummary = {
  stampsToday: number;
  stampsWeek: number;
  activeCustomers: number;
  newCustomersWeek: number;
  cardsNearGoal: number;
  pendingRewards: number;
  couponsActive: number;
};

type DayBucket = { day: string; count: number };

const SAO_PAULO = "America/Sao_Paulo";

/** UTC+14 — the furthest a calendar day can be from UTC's. */
const KIRITIMATI = "Pacific/Kiritimati";

/**
 * The painel: seven counters and a small chart, every one of them a SQL
 * aggregate bucketed by the STORE's timezone.
 *
 * Two things are being defended here. One is tenant isolation — a counter that
 * quietly adds up the neighbour's evening is worse than no counter. The other is
 * the day boundary: a shop that closes at 23:30 must see that last hour in
 * "hoje", even though 23:30 in São Paulo is already tomorrow in UTC.
 */
describe("API integration: dashboard", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function ownerOf(timezone = SAO_PAULO) {
    const { user, store } = await createStoreOwner({ timezone });
    mockAuthenticatedSession(user);
    return { user, store, app: createApp().app };
  }

  function summary(
    app: ReturnType<typeof createApp>["app"],
    storeId: string,
  ): Promise<Response> {
    return app.request(`/api/dashboard?storeId=${storeId}`);
  }

  /**
   * A known amount of every kind of activity the painel counts, so the isolation
   * test can assert exact numbers instead of "at least".
   *
   * Note the shapes that must NOT be counted anywhere: the stamper's own card
   * starts empty (10 away, so never "quase lá") and `createRewardWithCard`
   * leaves a COMPLETED card behind, which is not an active one.
   */
  async function seedActivity(
    storeId: string,
    counts: {
      stamps: number;
      nearGoal: number;
      pendingRewards: number;
      coupons: number;
    },
  ) {
    const program = await createProgram(storeId, { stampsRequired: 10 });

    const stamper = await createCustomer(storeId);
    const card = await createCard(storeId, program.id, stamper.id);

    for (let i = 0; i < counts.stamps; i += 1) {
      await createStamp(card);
    }

    for (let i = 0; i < counts.nearGoal; i += 1) {
      const customer = await createCustomer(storeId);
      await createCard(storeId, program.id, customer.id, { stampsCount: 9 });
    }

    for (let i = 0; i < counts.pendingRewards; i += 1) {
      const customer = await createCustomer(storeId);
      await createRewardWithCard(storeId, program.id, customer.id);
    }

    for (let i = 0; i < counts.coupons; i += 1) {
      await createCoupon(storeId);
    }

    return { program, stamper, card };
  }

  describe("tenant isolation", () => {
    it("counts nothing that belongs to the store next door", async () => {
      // The single most important assertion in this file: the neighbour is
      // deliberately BUSIER on every axis, so any counter that forgot its
      // `store_id` scope comes back too high rather than merely different.
      const { user, store: mine } = await createStoreOwner({
        timezone: SAO_PAULO,
      });
      const { store: theirs } = await createStoreOwner({ timezone: SAO_PAULO });

      await seedActivity(mine.id, {
        stamps: 3,
        nearGoal: 2,
        pendingRewards: 1,
        coupons: 1,
      });
      await seedActivity(theirs.id, {
        stamps: 11,
        nearGoal: 7,
        pendingRewards: 5,
        coupons: 4,
      });

      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await summary(app, mine.id);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual<DashboardSummary>({
        stampsToday: 3,
        stampsWeek: 3,
        // Only the one customer who was actually stamped.
        activeCustomers: 1,
        // 1 stamper + 2 near-goal + 1 with a reward.
        newCustomersWeek: 4,
        cardsNearGoal: 2,
        pendingRewards: 1,
        couponsActive: 1,
      });
    });

    it("404s a store the caller is not a member of", async () => {
      const { store: theirs } = await createStoreOwner();
      const { user: outsider } = await createStoreOwner();
      mockAuthenticatedSession(outsider);
      const { app } = createApp();

      const response = await summary(app, theirs.id);

      expect(response.status).toBe(404);
    });
  });

  describe("the day boundary", () => {
    it("counts 23:30 local as today and 00:30 the next local day as not", async () => {
      // 23:30 in São Paulo is 02:30 UTC on the FOLLOWING date. Bucketing on the
      // raw timestamp would drop the busiest half hour of the evening out of
      // "hoje" and into a tomorrow the lojista never sees.
      const { store, app } = await ownerOf(SAO_PAULO);
      const program = await createProgram(store.id);
      const customer = await createCustomer(store.id);
      const card = await createCard(store.id, program.id, customer.id);

      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { hours: 23, minutes: 30 }),
      });
      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { days: 1, minutes: 30 }),
      });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.stampsToday).toBe(1);
    });

    it("draws the boundary from the store's own timezone, not from Brazil's", async () => {
      // Kiritimati is UTC+14, twenty-six hours from Kiritimati's own evening to
      // São Paulo's. Each store is seeded at ITS OWN 23:30 and each must see
      // exactly one stamp today — which a boundary hardcoded to one timezone (or
      // to UTC) cannot deliver for both.
      for (const timezone of [SAO_PAULO, KIRITIMATI]) {
        const { user, store } = await createStoreOwner({ timezone });
        const program = await createProgram(store.id);
        const customer = await createCustomer(store.id);
        const card = await createCard(store.id, program.id, customer.id);

        await createStamp(card, {
          createdAt: await localInstant(timezone, { hours: 23, minutes: 30 }),
        });
        await createStamp(card, {
          createdAt: await localInstant(timezone, { days: 1, minutes: 30 }),
        });

        mockAuthenticatedSession(user);
        const body = (await (
          await summary(createApp().app, store.id)
        ).json()) as DashboardSummary;

        expect({ timezone, stampsToday: body.stampsToday }).toEqual({
          timezone,
          stampsToday: 1,
        });
      }
    });

    it("leaves a stamp from eight local days ago out of the week", async () => {
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id);
      const customer = await createCustomer(store.id);
      const card = await createCard(store.id, program.id, customer.id);

      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { days: -6, hours: 9 }),
      });
      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { days: -8, hours: 9 }),
      });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.stampsWeek).toBe(1);
      expect(body.stampsToday).toBe(0);
    });
  });

  describe("a store where nothing has happened", () => {
    it("answers with zeros, never with nulls", async () => {
      // A NULL renders as a blank tile, which reads as "carregando" or as a
      // broken painel. `count(*)` over no rows is 0; a `sum()` would not be.
      const { store, app } = await ownerOf();

      const response = await summary(app, store.id);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual<DashboardSummary>({
        stampsToday: 0,
        stampsWeek: 0,
        activeCustomers: 0,
        newCustomersWeek: 0,
        cardsNearGoal: 0,
        pendingRewards: 0,
        couponsActive: 0,
      });
    });
  });

  describe("cardsNearGoal", () => {
    it("counts 1 and 2 away, and nothing else", async () => {
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id, { stampsRequired: 10 });

      const cases = [
        { stampsCount: 9, status: "active" },
        { stampsCount: 8, status: "active" },
        // 3 away is not "quase lá" — it is an ordinary card.
        { stampsCount: 7, status: "active" },
        // Already at the goal: the prize exists, so there is nothing to nudge.
        { stampsCount: 10, status: "active" },
        { stampsCount: 9, status: "completed" },
      ];

      for (const seed of cases) {
        const customer = await createCustomer(store.id);
        await createCard(store.id, program.id, customer.id, seed);
      }

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.cardsNearGoal).toBe(2);
    });

    it("measures against the card's own goal, not the program's current one", async () => {
      // `cards.stamps_required` is a snapshot taken when the cycle opened.
      // Raising the program goal must not move the finish line for a card in
      // flight, and the tile has to agree with the card the customer is holding.
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id, { stampsRequired: 20 });
      const customer = await createCustomer(store.id);
      await createCard(store.id, program.id, customer.id, {
        stampsRequired: 10,
        stampsCount: 9,
      });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.cardsNearGoal).toBe(1);
    });
  });

  describe("pendingRewards", () => {
    it("skips codes that have expired and codes already handed over", async () => {
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id);
      const alive = await createCustomer(store.id);
      const expired = await createCustomer(store.id);
      const spent = await createCustomer(store.id);

      await createRewardWithCard(store.id, program.id, alive.id, {
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await createRewardWithCard(store.id, program.id, expired.id, {
        expiresAt: new Date(Date.now() - 1000),
      });
      await createRewardWithCard(store.id, program.id, spent.id, {
        status: "redeemed",
        redeemedAt: new Date(),
      });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.pendingRewards).toBe(1);
    });
  });

  describe("couponsActive", () => {
    it("counts only campaigns a customer could claim right now", async () => {
      const { store, app } = await ownerOf();
      const hour = 3_600_000;

      await createCoupon(store.id, { title: "Rodando" });
      await createCoupon(store.id, { title: "Rascunho", status: "draft" });
      await createCoupon(store.id, { title: "Encerrada", status: "archived" });
      await createCoupon(store.id, {
        title: "Ainda não começou",
        startsAt: new Date(Date.now() + hour),
      });
      await createCoupon(store.id, {
        title: "Já acabou",
        endsAt: new Date(Date.now() - hour),
      });
      await createCoupon(store.id, {
        title: "Esgotada",
        maxRedemptions: 2,
        redemptionCount: 2,
      });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.couponsActive).toBe(1);
    });
  });

  describe("voided stamps", () => {
    it("does not count a stamp the owner cancelled", async () => {
      // `void-stamp` decrements the card, so a counter that still sees the row
      // would disagree with the card the customer is holding.
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id);
      const customer = await createCustomer(store.id);
      const card = await createCard(store.id, program.id, customer.id);

      await createStamp(card);
      await createStamp(card, { voidedAt: new Date() });

      const body = (await (
        await summary(app, store.id)
      ).json()) as DashboardSummary;

      expect(body.stampsToday).toBe(1);
      expect(body.stampsWeek).toBe(1);
    });
  });

  describe("stamps-by-day", () => {
    it("returns one row per local day, including the quiet ones", async () => {
      // Dropping empty days would compress the chart and draw a dead Tuesday as
      // if it never existed — the flat stretch is what the lojista opened it for.
      const { store, app } = await ownerOf();
      const program = await createProgram(store.id);
      const customer = await createCustomer(store.id);
      const card = await createCard(store.id, program.id, customer.id);

      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { hours: 10 }),
      });
      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { hours: 11 }),
      });
      await createStamp(card, {
        createdAt: await localInstant(SAO_PAULO, { days: -2, hours: 10 }),
      });

      const response = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${store.id}&days=4`,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as DayBucket[];
      expect(body).toHaveLength(4);
      expect(body.map((bucket) => bucket.count)).toEqual([0, 1, 0, 2]);

      const today = await localInstant(SAO_PAULO);
      const days = body.map((bucket) => bucket.day);
      expect(days.at(-1)).toBe(
        new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO }).format(today),
      );
      expect(new Set(days).size).toBe(4);
      expect([...days].sort()).toEqual(days);
    });

    it("gives a silent store a full row of zeros rather than an empty list", async () => {
      const { store, app } = await ownerOf();

      const response = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${store.id}&days=7`,
      );

      const body = (await response.json()) as DayBucket[];
      expect(body).toHaveLength(7);
      expect(body.every((bucket) => bucket.count === 0)).toBe(true);
    });

    it("defaults to a fortnight", async () => {
      const { store, app } = await ownerOf();

      const response = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${store.id}`,
      );

      expect((await response.json()) as DayBucket[]).toHaveLength(14);
    });

    it("refuses a window nobody's phone is going to render", async () => {
      const { store, app } = await ownerOf();

      const response = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${store.id}&days=900`,
      );

      expect(response.status).toBe(400);
    });

    it("never counts the store next door", async () => {
      const { user, store: mine } = await createStoreOwner({
        timezone: SAO_PAULO,
      });
      const { store: theirs } = await createStoreOwner({ timezone: SAO_PAULO });
      await seedActivity(theirs.id, {
        stamps: 6,
        nearGoal: 0,
        pendingRewards: 0,
        coupons: 0,
      });

      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${mine.id}&days=3`,
      );

      const body = (await response.json()) as DayBucket[];
      expect(body.map((bucket) => bucket.count)).toEqual([0, 0, 0]);
    });
  });

  describe("who may read", () => {
    it("lets a cashier open both endpoints", async () => {
      // Not owner-only on purpose: the person at the counter is the one who can
      // act on "está a um carimbo do prêmio".
      const { store } = await createStoreOwner({ timezone: SAO_PAULO });
      await seedActivity(store.id, {
        stamps: 2,
        nearGoal: 1,
        pendingRewards: 0,
        coupons: 0,
      });
      const cashier = await createStoreCashier(store.id);
      mockAuthenticatedSession(cashier);
      const { app } = createApp();

      const counters = await summary(app, store.id);
      const chart = await app.request(
        `/api/dashboard/stamps-by-day?storeId=${store.id}&days=3`,
      );

      expect(counters.status).toBe(200);
      expect(((await counters.json()) as DashboardSummary).cardsNearGoal).toBe(
        1,
      );
      expect(chart.status).toBe(200);
      expect((await chart.json()) as DayBucket[]).toHaveLength(3);
    });
  });
});
