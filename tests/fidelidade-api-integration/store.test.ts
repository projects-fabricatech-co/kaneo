import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createStoreOwner, createUser } from "./helpers/fixtures";

describe("API integration: stores", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated requests with a plain-text Unauthorized", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/store", {
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(401);
    // HTTPException({ message }) renders as text, not JSON.
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("leaves the health check public", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("creates a store and the owner membership row in one transaction", async () => {
    const user = await createUser();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Padaria da Esquina",
        slug: "padaria-da-esquina",
      }),
    });

    expect(response.status).toBe(200);
    const created =
      (await response.json()) as typeof schema.storeTable.$inferSelect;
    expect(created).toMatchObject({
      name: "Padaria da Esquina",
      slug: "padaria-da-esquina",
      ownerUserId: user.id,
    });

    const persisted = await db.query.storeTable.findFirst({
      where: eq(schema.storeTable.id, created.id),
    });
    expect(persisted).toBeDefined();

    const members = await db
      .select()
      .from(schema.storeMemberTable)
      .where(eq(schema.storeMemberTable.storeId, created.id));

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: user.id, role: "owner" });
  });

  it("normalizes the whatsapp number on the way in", async () => {
    const user = await createUser();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Bar do Ze",
        slug: "bar-do-ze",
        // Old-style 10-digit mobile: the 9th-digit rule must apply.
        whatsapp: "(11) 8765-4321",
      }),
    });

    expect(response.status).toBe(200);
    const created =
      (await response.json()) as typeof schema.storeTable.$inferSelect;
    expect(created.whatsapp).toBe("+5511987654321");
  });

  it("refuses a duplicate slug", async () => {
    const user = await createUser();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const body = JSON.stringify({ name: "Loja Um", slug: "loja-repetida" });
    const first = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(first.status).toBe(200);

    const other = await createUser();
    mockAuthenticatedSession(other);
    const { app: secondApp } = createApp();

    const second = await secondApp.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    expect(second.status).toBe(409);
  });

  it("rejects an invalid slug at the edge", async () => {
    const user = await createUser();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Loja", slug: "Não Válido!" }),
    });

    expect(response.status).toBe(400);
  });

  it("lists only the stores the caller belongs to", async () => {
    const { user, store } = await createStoreOwner({ storeName: "Minha Loja" });
    await createStoreOwner({ storeName: "Loja de Outro" });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/store");

    expect(response.status).toBe(200);
    const stores = (await response.json()) as { id: string; name: string }[];
    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({ id: store.id, name: "Minha Loja" });
  });

  it("reads and updates a store the caller owns", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const read = await app.request(`/api/store/${store.id}`);
    expect(read.status).toBe(200);

    const updated = await app.request(`/api/store/${store.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Nome Novo" }),
    });

    expect(updated.status).toBe(200);
    const persisted = await db.query.storeTable.findFirst({
      where: eq(schema.storeTable.id, store.id),
    });
    expect(persisted?.name).toBe("Nome Novo");
  });
});
