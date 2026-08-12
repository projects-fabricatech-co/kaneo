import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createStoreCashier, createStoreOwner } from "./helpers/fixtures";

/**
 * The cashier is a counter operator: anything that happens with a customer
 * standing there is allowed, anything that changes the rules of the game, the
 * money, or the roster is owner-only.
 */
describe("API integration: store roles", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lets a cashier read the store and the team", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    await expect(
      app.request(`/api/store/${store.id}`).then((r) => r.status),
    ).resolves.toBe(200);
    await expect(
      app.request(`/api/store/${store.id}/members`).then((r) => r.status),
    ).resolves.toBe(200);
  });

  it("lists the cashier's store among their stores", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await app.request("/api/store");
    const stores = (await response.json()) as { id: string }[];

    expect(stores.map((s) => s.id)).toEqual([store.id]);
  });

  it("blocks a cashier from editing the store", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await app.request(`/api/store/${store.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renomeada pelo caixa" }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe(
      "Ação permitida apenas ao proprietário",
    );
  });

  it("blocks a cashier from archiving the store", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await app.request(`/api/store/${store.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
  });

  it("blocks a cashier from managing the roster", async () => {
    // Owner-only because the roster is how access to the till is granted.
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    const other = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const add = await app.request(`/api/store/${store.id}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "novo@example.com", role: "cashier" }),
    });
    expect(add.status).toBe(403);

    const changeRole = await app.request(
      `/api/store/${store.id}/members/${other.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "owner" }),
      },
    );
    expect(changeRole.status).toBe(403);

    const remove = await app.request(
      `/api/store/${store.id}/members/${other.id}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(403);
  });

  it("blocks a cashier from changing branding", async () => {
    const { store } = await createStoreOwner({ plan: "pro" });
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await app.request(`/api/store/${store.id}/branding`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandColor: "#000000" }),
    });

    expect(response.status).toBe(403);
  });

  it("lets the owner do all of it", async () => {
    const { user, store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const changeRole = await app.request(
      `/api/store/${store.id}/members/${cashier.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "owner" }),
      },
    );
    expect(changeRole.status).toBe(200);

    const remove = await app.request(
      `/api/store/${store.id}/members/${cashier.id}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(200);
  });
});
