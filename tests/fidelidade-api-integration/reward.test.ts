import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { isUniqueViolation } from "../../apps/fidelidade-api/src/utils/unique-violation";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCustomer,
  createProgram,
  createRewardWithCard,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

type StampResult = {
  card: { id: string; status: string; stampsCount: number };
  replayed: boolean;
  reward: {
    id: string;
    cardId: string;
    code: string;
    description: string;
    status: string;
    expiresAt: string | null;
  } | null;
};

/**
 * The prize is created by the stamp that fills the card, inside that stamp's
 * transaction, and never anywhere else. These tests are about the "exactly once"
 * part: a card that mints two codes is a shop giving away two coffees, and a card
 * that mints none is a customer who filled ten squares for nothing.
 */
describe("API integration: rewards", () => {
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

    mockAuthenticatedSession(user);

    return { user, store, program, customer, app: createApp().app };
  }

  function stamp(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/stamp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: randomUUID(), ...body }),
    });
  }

  async function countRewards() {
    const [row] = await db.select({ value: count() }).from(schema.rewardTable);
    return Number(row?.value ?? 0);
  }

  it("mints the reward on the stamp that hits the goal, and not one stamp earlier", async () => {
    const { store, program, customer, app } = await seed({ stampsRequired: 3 });

    for (const expected of [1, 2]) {
      const response = await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      });
      const body = (await response.json()) as StampResult;

      expect(body.card.stampsCount).toBe(expected);
      expect(body.card.status).toBe("active");
      // Nothing to hand over yet, and nothing in the table to hand over.
      expect(body.reward).toBeNull();
      await expect(countRewards()).resolves.toBe(0);
    }

    const completing = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const body = (await completing.json()) as StampResult;

    expect(body.card.status).toBe("completed");
    expect(body.reward).not.toBeNull();
    expect(body.reward?.cardId).toBe(body.card.id);
    expect(body.reward?.status).toBe("pending");
    // `P` de prêmio: the prefix is what lets one input field route the code.
    expect(body.reward?.code.startsWith("P")).toBe(true);
    // Snapshot of the program's wording at the moment the code was issued.
    expect(body.reward?.description).toBe("Um café grátis");

    await expect(countRewards()).resolves.toBe(1);
  });

  it("refuses to mint a second reward for the same card", async () => {
    // `rewards_cardId_unique` is the structural guarantee behind "exactly once",
    // not the code path above. Assert the constraint itself exists and bites.
    const { store, program, customer, app } = await seed({ stampsRequired: 1 });

    const response = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const body = (await response.json()) as StampResult;
    const cardId = body.card.id;

    const duplicate = await db
      .insert(schema.rewardTable)
      .values({
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        cardId,
        code: "PXXXXXX",
        description: "Um segundo café, indevido",
      })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(isUniqueViolation(duplicate, "rewards_cardId_unique")).toBe(true);

    await expect(countRewards()).resolves.toBe(1);
  });

  it("does not mint a second reward when a completed card is stamped again", async () => {
    const { store, program, customer, app } = await seed({ stampsRequired: 1 });

    await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    await expect(countRewards()).resolves.toBe(1);

    const overflow = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });

    expect(overflow.status).toBe(409);
    await expect(countRewards()).resolves.toBe(1);
  });

  it("reports the same reward when the completing stamp is retried", async () => {
    // The dropped-response case, on the one request that mattered most: the
    // cashier's phone must be told about the code it already created.
    const { store, program, customer, app } = await seed({ stampsRequired: 1 });
    const idempotencyKey = randomUUID();

    const first = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey,
      })
    ).json()) as StampResult;

    const retry = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey,
      })
    ).json()) as StampResult;

    expect(retry.replayed).toBe(true);
    expect(retry.reward?.id).toBe(first.reward?.id);
    await expect(countRewards()).resolves.toBe(1);
  });

  it("dates the expiry from the program's validity window", async () => {
    const { store, program, customer, app } = await seed({
      stampsRequired: 1,
      rewardValidityDays: 15,
    });

    const before = Date.now();
    const response = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const after = Date.now();
    const body = (await response.json()) as StampResult;

    const expiresAt = new Date(body.reward?.expiresAt ?? 0).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 15 * DAY_MS - 5_000);
    expect(expiresAt).toBeLessThanOrEqual(after + 15 * DAY_MS + 5_000);
  });

  it("leaves the expiry null when the program sets no validity", async () => {
    // A validity of 0 means "vale para sempre". NULL rather than a far-future
    // date, so the redemption predicate needs no special case.
    const { store, program, customer, app } = await seed({
      stampsRequired: 1,
      rewardValidityDays: 0,
    });

    const response = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const body = (await response.json()) as StampResult;

    expect(body.reward?.expiresAt).toBeNull();

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, body.reward?.id ?? ""),
    });
    expect(persisted?.expiresAt).toBeNull();
  });

  it("keeps a reward the customer already holds when the program wording changes", async () => {
    const { store, program, customer, app } = await seed({ stampsRequired: 1 });

    const body = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;

    await db
      .update(schema.programTable)
      .set({ rewardDescription: "Um café E um pão de queijo" })
      .where(eq(schema.programTable.id, program.id));

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, body.reward?.id ?? ""),
    });
    expect(persisted?.description).toBe("Um café grátis");
  });

  describe("listing", () => {
    async function seedThree() {
      const { user, store } = await createStoreOwner();
      const program = await createProgram(store.id, { stampsRequired: 1 });

      const pendingCustomer = await createCustomer(store.id);
      const redeemedCustomer = await createCustomer(store.id);
      const expiredCustomer = await createCustomer(store.id);

      const pending = await createRewardWithCard(
        store.id,
        program.id,
        pendingCustomer.id,
        { expiresAt: new Date(Date.now() + 7 * DAY_MS) },
      );
      const redeemed = await createRewardWithCard(
        store.id,
        program.id,
        redeemedCustomer.id,
        { status: "redeemed", redeemedAt: new Date() },
      );
      const expired = await createRewardWithCard(
        store.id,
        program.id,
        expiredCustomer.id,
        { expiresAt: new Date(Date.now() - DAY_MS) },
      );

      mockAuthenticatedSession(user);

      return { user, store, pending, redeemed, expired, app: createApp().app };
    }

    it("lists every reward, in either state", async () => {
      const { store, pending, redeemed, expired, app } = await seedThree();

      const response = await app.request(`/api/reward?storeId=${store.id}`);
      expect(response.status).toBe(200);

      const rewards = (await response.json()) as { id: string }[];
      expect(rewards.map((reward) => reward.id).sort()).toEqual(
        [pending.reward.id, redeemed.reward.id, expired.reward.id].sort(),
      );
    });

    it("narrows to one state on request", async () => {
      const { store, redeemed, app } = await seedThree();

      const response = await app.request(
        `/api/reward?storeId=${store.id}&status=redeemed`,
      );
      const rewards = (await response.json()) as { id: string }[];

      expect(rewards.map((reward) => reward.id)).toEqual([redeemed.reward.id]);
    });

    it("shows only what a cashier could still hand over under /pending", async () => {
      // Redeemed is spent and expired is dead: neither is waiting for anyone.
      const { store, pending, app } = await seedThree();

      const response = await app.request(
        `/api/reward/pending?storeId=${store.id}`,
      );
      expect(response.status).toBe(200);

      const rewards = (await response.json()) as { id: string }[];
      expect(rewards.map((reward) => reward.id)).toEqual([pending.reward.id]);
    });

    it("lets a cashier read the pending list", async () => {
      const { store } = await seedThree();
      const cashier = await createStoreCashier(store.id);
      mockAuthenticatedSession(cashier);
      const { app } = createApp();

      const response = await app.request(
        `/api/reward/pending?storeId=${store.id}`,
      );

      expect(response.status).toBe(200);
    });

    it("rejects an unknown status rather than silently listing everything", async () => {
      const { store, app } = await seedThree();

      const response = await app.request(
        `/api/reward?storeId=${store.id}&status=expired`,
      );

      expect(response.status).toBe(400);
    });
  });
});
