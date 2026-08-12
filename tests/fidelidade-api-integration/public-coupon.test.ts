import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createCoupon, createStoreOwner } from "./helpers/fixtures";

/**
 * The campaign landing page: unauthenticated, indexed by an opaque token, and
 * returning tenant data. Everything here is about what it must NOT say.
 */
describe("API integration: public coupon page", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed(
    overrides: Partial<typeof schema.couponTable.$inferInsert> = {},
  ) {
    const { store } = await createStoreOwner({ plan: "essencial" });
    const coupon = await createCoupon(store.id, overrides);
    return { store, coupon, app: createApp().app };
  }

  it("is readable with no session at all", async () => {
    const { coupon, app } = await seed();

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );

    expect(response.status).toBe(200);
  });

  it("returns exactly the allowlisted keys, and nothing else", async () => {
    const { coupon, app } = await seed();

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(
      [
        "description",
        "discountLabel",
        "endsAt",
        "soldOut",
        "store",
        "title",
      ].sort(),
    );
    expect(Object.keys(body.store as object).sort()).toEqual(
      ["brandColor", "brandTextColor", "city", "logoUrl", "name"].sort(),
    );
  });

  it("never reveals how many times the campaign was redeemed", async () => {
    // `redemptionCount` and `maxRedemptions` together would let a competitor
    // standing outside meter the shop's traffic. `soldOut` is the only fact a
    // customer actually needs.
    const { coupon, app } = await seed({
      maxRedemptions: 100,
      redemptionCount: 37,
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const raw = await response.text();

    expect(raw).not.toContain("redemptionCount");
    expect(raw).not.toContain("maxRedemptions");
    expect(raw).not.toContain("37");
  });

  it("never leaks an internal id", async () => {
    const { store, coupon, app } = await seed();

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const raw = await response.text();

    expect(raw).not.toContain(coupon.id);
    expect(raw).not.toContain(store.id);
    expect(raw).not.toContain(store.ownerUserId);
    expect(raw).not.toContain("storeId");
    expect(raw).not.toContain("couponId");
  });

  it("reports soldOut once the cap is reached, without saying what the cap is", async () => {
    const { coupon, app } = await seed({
      maxRedemptions: 5,
      redemptionCount: 5,
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const body = (await response.json()) as { soldOut: boolean };

    expect(body.soldOut).toBe(true);
  });

  it("is not sold out while slots remain", async () => {
    const { coupon, app } = await seed({
      maxRedemptions: 5,
      redemptionCount: 4,
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const body = (await response.json()) as { soldOut: boolean };

    expect(body.soldOut).toBe(false);
  });

  it("is never sold out when the campaign is uncapped", async () => {
    const { coupon, app } = await seed({
      maxRedemptions: null,
      redemptionCount: 9999,
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const body = (await response.json()) as { soldOut: boolean };

    expect(body.soldOut).toBe(false);
  });

  it("404s an unknown token", async () => {
    const { app } = await seed();

    const response = await app.request("/api/public/coupon/nao-existe");

    expect(response.status).toBe(404);
  });

  it("404s an archived campaign", async () => {
    const { coupon, app } = await seed();
    await db
      .update(schema.couponTable)
      .set({ status: "archived" })
      .where(eq(schema.couponTable.id, coupon.id));

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );

    expect(response.status).toBe(404);
  });

  it("404s a campaign that has not started", async () => {
    const { coupon, app } = await seed({
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );

    expect(response.status).toBe(404);
  });

  it("404s a campaign that already ended", async () => {
    const { coupon, app } = await seed({
      endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );

    expect(response.status).toBe(404);
  });

  it("withholds the store's branding on a plan that does not include it", async () => {
    // Same rule as the loyalty card: a Grátis store gets the default colour and
    // no logo, whatever is stored on the row.
    const { store } = await createStoreOwner();
    await db
      .update(schema.storeTable)
      .set({ logoUrl: "https://cdn.test/logo.png", brandColor: "#123456" })
      .where(eq(schema.storeTable.id, store.id));
    const coupon = await createCoupon(store.id);
    const { app } = createApp();

    const response = await app.request(
      `/api/public/coupon/${coupon.publicToken}`,
    );
    const body = (await response.json()) as {
      store: { logoUrl: string | null; brandColor: string };
    };

    expect(body.store.logoUrl).toBeNull();
    expect(body.store.brandColor).not.toBe("#123456");
  });
});
