import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
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

/**
 * The lojista types a code to see what it promises BEFORE handing anything over.
 * Looking has to be free — if checking a code could spend it, nobody would
 * check, and the confirmation step the screen is built around would be a lie.
 */
describe("API integration: validating a code", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed() {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id, {
      stampsRequired: 1,
      rewardDescription: "Um café grátis",
    });

    mockAuthenticatedSession(user);

    return { user, store, program, app: createApp().app };
  }

  async function rewardFor(
    storeId: string,
    programId: string,
    overrides: Parameters<typeof createRewardWithCard>[3] = {},
  ) {
    const customer = await createCustomer(storeId);
    return createRewardWithCard(storeId, programId, customer.id, {
      description: "Um café grátis",
      ...overrides,
    });
  }

  function validate(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/code/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("describes a usable prize code without changing a single column", async () => {
    const { store, program, app } = await seed();
    const expiresAt = new Date(Date.now() + 7 * DAY_MS);
    const { card, reward } = await rewardFor(store.id, program.id, {
      expiresAt,
    });

    const before = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });

    const response = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "code",
      "description",
      "expiresAt",
      "kind",
      "redeemedAt",
      "status",
      "usable",
    ]);
    expect(body).toMatchObject({
      kind: "reward",
      code: reward.code,
      description: "Um café grátis",
      status: "pending",
      redeemedAt: null,
      usable: true,
    });
    expect(new Date(body.expiresAt as string).toISOString()).toBe(
      expiresAt.toISOString(),
    );

    // THE assertion of this file: the row is byte-for-byte what it was.
    const after = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(after).toEqual(before);

    // And the card behind it did not roll over.
    const persistedCard = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.id, card.id),
    });
    expect(persistedCard?.status).toBe("completed");
    expect(persistedCard?.redeemedAt).toBeNull();
  });

  it("reports a spent code as redeemed, still without writing", async () => {
    const { store, program, app } = await seed();
    const redeemedAt = new Date(Date.now() - DAY_MS);
    const { reward } = await rewardFor(store.id, program.id, {
      status: "redeemed",
      redeemedAt,
    });

    const before = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });

    const response = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("redeemed");
    expect(body.usable).toBe(false);
    expect(new Date(body.redeemedAt as string).toISOString()).toBe(
      redeemedAt.toISOString(),
    );

    const after = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(after).toEqual(before);
  });

  it("reports an out-of-date code as expired", async () => {
    // Derived from `expiresAt`, not from the status column, which still says
    // `pending` — the screen must not have to know that.
    const { store, program, app } = await seed();
    const { reward } = await rewardFor(store.id, program.id, {
      expiresAt: new Date(Date.now() - DAY_MS),
    });

    const response = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("expired");
    expect(body.usable).toBe(false);

    const persisted = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(persisted?.status).toBe("pending");
  });

  it("treats a code with no expiry as usable forever", async () => {
    const { store, program, app } = await seed();
    const { reward } = await rewardFor(store.id, program.id, {
      expiresAt: null,
    });

    const response = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "pending",
      usable: true,
      expiresAt: null,
    });
  });

  it("dispatches on the prefix: P is a prize, C belongs to Phase 4", async () => {
    const { store, program, app } = await seed();
    const { reward } = await rewardFor(store.id, program.id);

    expect(reward.code.startsWith("P")).toBe(true);

    const prize = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });
    expect(prize.status).toBe(200);
    await expect(prize.json()).resolves.toMatchObject({ kind: "reward" });

    const coupon = await validate(app, { storeId: store.id, code: "CKM4T9P" });
    expect(coupon.status).toBe(501);
    await expect(coupon.json()).resolves.toMatchObject({
      error: "coupon_not_available",
    });
  });

  it("rejects an unknown prefix cleanly, as a bad code rather than a missing one", async () => {
    const { store, app } = await seed();

    const response = await validate(app, { storeId: store.id, code: "XKM4T9" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_code",
      message: expect.stringContaining("inválido"),
    });
  });

  it("rejects an empty code at the validator", async () => {
    const { store, app } = await seed();

    const response = await validate(app, { storeId: store.id, code: "   " });

    expect(response.status).toBe(400);
  });

  it("404s a code that does not exist in this store", async () => {
    const { store, app } = await seed();

    const response = await validate(app, {
      storeId: store.id,
      code: "PZZZZZZ",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "code_not_found",
    });
  });

  it("accepts the code as typed on a phone keyboard", async () => {
    const { store, program, app } = await seed();
    const { reward } = await rewardFor(store.id, program.id);

    const response = await validate(app, {
      storeId: store.id,
      code: ` ${reward.code.toLowerCase()}\n`,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: reward.code,
    });
  });

  it("lets a cashier validate", async () => {
    const { store, program } = await seed();
    const { reward } = await rewardFor(store.id, program.id);

    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await validate(app, {
      storeId: store.id,
      code: reward.code,
    });

    expect(response.status).toBe(200);
  });
});
