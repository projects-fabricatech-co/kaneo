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
  seedTwoIsolatedStores,
} from "./helpers/fixtures";

/**
 * The load-bearing test for the whole tenancy model.
 *
 * Isolation here is enforced by application-layer scoping rather than Postgres
 * RLS, which means it is a property of the code and has to be asserted, not
 * assumed. Every phase adds its resources to this file.
 */
describe("API integration: store isolation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("hides another owner's store behind a 404, not a 403", async () => {
    // 403 would confirm that a store with this id exists, turning the endpoint
    // into a cross-tenant enumeration oracle.
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await app.request(`/api/store/${b.store.id}`);

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Loja não encontrada");
  });

  it("hides another owner's team", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await app.request(`/api/store/${b.store.id}/members`);

    expect(response.status).toBe(404);
  });

  it("refuses writes to another owner's store", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const update = await app.request(`/api/store/${b.store.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Invadida" }),
    });
    expect(update.status).toBe(404);

    const archive = await app.request(`/api/store/${b.store.id}`, {
      method: "DELETE",
    });
    expect(archive.status).toBe(404);
  });

  it("refuses to add a member to another owner's store", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await app.request(`/api/store/${b.store.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: a.user.email, role: "cashier" }),
    });

    expect(response.status).toBe(404);
  });

  it("never leaks the other store through the list endpoint", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await app.request("/api/store");
    const stores = (await response.json()) as { id: string }[];

    expect(stores.map((store) => store.id)).toEqual([a.store.id]);
    expect(stores.map((store) => store.id)).not.toContain(b.store.id);
  });

  it("hides another store's rewards", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const list = await app.request(`/api/reward?storeId=${b.store.id}`);
    expect(list.status).toBe(404);

    const pending = await app.request(
      `/api/reward/pending?storeId=${b.store.id}`,
    );
    expect(pending.status).toBe(404);
  });

  it("refuses to validate or redeem against another owner's store", async () => {
    const { a, b } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    for (const path of ["/api/code/validate", "/api/code/redeem"]) {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId: b.store.id, code: "PKM4T9X" }),
      });

      expect(response.status).toBe(404);
      await expect(response.text()).resolves.toBe("Loja não encontrada");
    }
  });

  it("treats another store's code as a code that does not exist", async () => {
    // The code is real, and store A must not be able to learn that — nor spend
    // it. Both endpoints answer exactly as they would for a typo.
    const { a, b } = await seedTwoIsolatedStores();

    const program = await createProgram(b.store.id, { stampsRequired: 1 });
    const customer = await createCustomer(b.store.id);
    const { reward } = await createRewardWithCard(
      b.store.id,
      program.id,
      customer.id,
    );

    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    for (const path of ["/api/code/validate", "/api/code/redeem"]) {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId: a.store.id, code: reward.code }),
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "code_not_found",
      });
    }

    const untouched = await db.query.rewardTable.findFirst({
      where: eq(schema.rewardTable.id, reward.id),
    });
    expect(untouched?.status).toBe("pending");
    expect(untouched?.redeemedAt).toBeNull();
  });

  it("returns 404 for a store id that does not exist at all", async () => {
    // Same answer as "exists but not yours" — the two must be indistinguishable.
    const { a } = await seedTwoIsolatedStores();
    mockAuthenticatedSession(a.user);
    const { app } = createApp();

    const response = await app.request("/api/store/does-not-exist");

    expect(response.status).toBe(404);
  });
});
