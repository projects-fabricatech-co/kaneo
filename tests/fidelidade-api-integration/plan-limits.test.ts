import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createStoreOwner, createUser, grantPlan } from "./helpers/fixtures";

/**
 * Limits are enforced on the server, and they are enforced whether or not Stripe
 * is configured — an account with no subscription row is simply on Grátis.
 */
describe("API integration: plan limits", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stops a Grátis account at one store, with a machine-readable 402", async () => {
    const { user } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Segunda Loja", slug: "segunda-loja" }),
    });

    expect(response.status).toBe(402);

    // A JSON body, not HTTPException's plain text: the web client has to be able
    // to tell a plan limit from any other error and open the upgrade sheet.
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      error: "plan_limit_exceeded",
      limit: "maxStores",
      max: 1,
      plan: "gratis",
    });
    expect(typeof body.message).toBe("string");
    expect(body.message as string).toMatch(/plano/i);
  });

  it("lets a Pro account open a second store", async () => {
    const { user } = await createStoreOwner({ plan: "pro" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unidade Centro", slug: "unidade-centro" }),
    });

    expect(response.status).toBe(200);
  });

  it("treats a lapsed paid subscription as Grátis", async () => {
    const user = await createUser();
    await grantPlan(user.id, "pro", { status: "canceled" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Loja Um", slug: "loja-um-lapsed" }),
    });
    expect(first.status).toBe(200);

    const second = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Loja Dois", slug: "loja-dois-lapsed" }),
    });
    expect(second.status).toBe(402);
  });

  it("honours a live trial on a paid plan", async () => {
    const user = await createUser();
    await grantPlan(user.id, "pro", {
      status: "incomplete",
      trialEndsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    for (const slug of ["trial-um", "trial-dois"]) {
      const response = await app.request("/api/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: slug, slug }),
      });
      expect(response.status).toBe(200);
    }
  });

  it("holds the store limit under concurrent creates", async () => {
    // The reason the limit check lives inside the controller's transaction
    // behind an advisory lock: a count-then-insert with a gap would let several
    // concurrent requests all observe "0 stores" and all insert.
    const user = await createUser();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const attempts = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        app.request("/api/store", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `Loja ${n}`, slug: `corrida-${n}` }),
        }),
      ),
    );

    const statuses = attempts.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 402)).toHaveLength(4);

    const [row] = await db
      .select({ value: count() })
      .from(schema.storeTable)
      .where(eq(schema.storeTable.ownerUserId, user.id));

    expect(Number(row?.value)).toBe(1);
  });

  it("gates branding behind a paid plan", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/store/${store.id}/branding`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandColor: "#123456" }),
    });

    expect(response.status).toBe(402);
  });

  it("allows branding on a paid plan", async () => {
    const { user, store } = await createStoreOwner({ plan: "essencial" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/store/${store.id}/branding`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandColor: "#123456" }),
    });

    expect(response.status).toBe(200);
    const persisted = await db.query.storeTable.findFirst({
      where: eq(schema.storeTable.id, store.id),
    });
    expect(persisted?.brandColor).toBe("#123456");
  });
});
