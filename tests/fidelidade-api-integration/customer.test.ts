import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCustomer,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

type CustomerRow = {
  id: string;
  storeId: string;
  name: string | null;
  phone: string;
  publicToken: string;
  notes: string | null;
  archivedAt: string | null;
};

type FindOrCreateBody = { customer: CustomerRow; created: boolean };

describe("API integration: customers", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  function findOrCreate(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/customer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("normalizes the phone on create", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await findOrCreate(app, {
      storeId: store.id,
      phone: "(11) 98765-4321",
      name: "  Joana Silva  ",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as FindOrCreateBody;
    expect(body.created).toBe(true);
    expect(body.customer.phone).toBe("+5511987654321");
    expect(body.customer.name).toBe("Joana Silva");
    expect(body.customer.publicToken).toHaveLength(22);
  });

  it("rejects an unusable phone with a 422", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await findOrCreate(app, {
      storeId: store.id,
      phone: "123",
    });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("Telefone inválido");
  });

  it("is idempotent: the same phone in four formats yields ONE customer", async () => {
    // The `(storeId, phone)` unique index plus normalization is what stops one
    // person becoming four rows with four separate cards.
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const formats = [
      "11987654321",
      "(11) 98765-4321",
      "+55 11 98765-4321",
      "011 98765 4321",
    ];

    const ids = new Set<string>();

    for (const [index, phone] of formats.entries()) {
      const response = await findOrCreate(app, { storeId: store.id, phone });
      expect(response.status).toBe(200);

      const body = (await response.json()) as FindOrCreateBody;
      // Only the first call created anything.
      expect(body.created).toBe(index === 0);
      ids.add(body.customer.id);
    }

    expect(ids.size).toBe(1);

    const [row] = await db
      .select({ value: count() })
      .from(schema.customerTable)
      .where(eq(schema.customerTable.storeId, store.id));
    expect(Number(row?.value)).toBe(1);
  });

  it("keeps the SAME phone in two different stores as two customers", async () => {
    // Tenants are independent: the bakery and the barber each hold their own
    // relationship with the same person, with their own card and their own token.
    const a = await createStoreOwner({ storeName: "Padaria" });
    const b = await createStoreOwner({ storeName: "Barbearia" });

    mockAuthenticatedSession(a.user);
    const appA = createApp().app;
    const first = (await (
      await findOrCreate(appA, { storeId: a.store.id, phone: "11987654321" })
    ).json()) as FindOrCreateBody;

    mockAuthenticatedSession(b.user);
    const appB = createApp().app;
    const second = (await (
      await findOrCreate(appB, { storeId: b.store.id, phone: "11987654321" })
    ).json()) as FindOrCreateBody;

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.customer.id).not.toBe(second.customer.id);
    expect(first.customer.publicToken).not.toBe(second.customer.publicToken);

    const [row] = await db
      .select({ value: count() })
      .from(schema.customerTable);
    expect(Number(row?.value)).toBe(2);
  });

  it("finds a customer typed the old way, without the 9th digit", async () => {
    // Stored as 11 digits after the 9th-digit rule; a cashier who types the old
    // 10-digit number must still land on the same person.
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = (await (
      await findOrCreate(app, { storeId: store.id, phone: "11987654321" })
    ).json()) as FindOrCreateBody;
    expect(created.customer.phone).toBe("+5511987654321");

    const lookup = await app.request(
      `/api/customer/lookup?storeId=${store.id}&phone=1187654321`,
    );
    expect(lookup.status).toBe(200);

    const body = (await lookup.json()) as {
      phone: string;
      customer: CustomerRow | null;
    };
    expect(body.phone).toBe("+5511987654321");
    expect(body.customer?.id).toBe(created.customer.id);
  });

  it("answers lookup with a null customer rather than a 404 when nobody matches", async () => {
    // "This number has no card yet" is the normal case at the counter, and the
    // caller needs the normalized phone back to hand to find-or-create.
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/customer/lookup?storeId=${store.id}&phone=(11)%2099999-1234`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      phone: "+5511999991234",
      customer: null,
    });
  });

  it("lets a cashier look up, enrol and rename a customer", async () => {
    const { store } = await createStoreOwner();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const created = await findOrCreate(app, {
      storeId: store.id,
      phone: "11987654321",
    });
    expect(created.status).toBe(200);
    const { customer } = (await created.json()) as FindOrCreateBody;

    const renamed = await app.request(`/api/customer/${customer.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Joana", notes: "Prefere sem açúcar" }),
    });
    expect(renamed.status).toBe(200);
    await expect(renamed.json()).resolves.toMatchObject({
      name: "Joana",
      notes: "Prefere sem açúcar",
    });

    const lookup = await app.request(
      `/api/customer/lookup?storeId=${store.id}&phone=11987654321`,
    );
    expect(lookup.status).toBe(200);
  });

  it("refuses a cashier the owner-only actions", async () => {
    const { store } = await createStoreOwner();
    const customer = await createCustomer(store.id);
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const archive = await app.request(`/api/customer/${customer.id}/archive`, {
      method: "POST",
    });
    expect(archive.status).toBe(403);

    const rotate = await app.request(
      `/api/customer/${customer.id}/rotate-token`,
      { method: "POST" },
    );
    expect(rotate.status).toBe(403);
  });

  it("rotates the public token, revoking the old link", async () => {
    const { user, store } = await createStoreOwner();
    const customer = await createCustomer(store.id);
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/customer/${customer.id}/rotate-token`,
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as CustomerRow;
    expect(body.publicToken).not.toBe(customer.publicToken);

    // The old link stops resolving immediately — there is no grace period,
    // because the reason to rotate is that someone else has the link.
    const old = await app.request(`/api/public/card/${customer.publicToken}`);
    expect(old.status).toBe(404);

    const fresh = await app.request(`/api/public/card/${body.publicToken}`);
    expect(fresh.status).toBe(200);
  });

  it("archives a customer and hides it from the browse list", async () => {
    const { user, store } = await createStoreOwner();
    const kept = await createCustomer(store.id, { name: "Ana" });
    const gone = await createCustomer(store.id, { name: "Bruno" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const archive = await app.request(`/api/customer/${gone.id}/archive`, {
      method: "POST",
    });
    expect(archive.status).toBe(200);

    const list = await app.request(`/api/customer?storeId=${store.id}`);
    const body = (await list.json()) as { items: CustomerRow[] };
    expect(body.items.map((item) => item.id)).toEqual([kept.id]);
  });

  it("still resolves an archived customer by phone, rather than duplicating them", async () => {
    const { user, store } = await createStoreOwner();
    const customer = await createCustomer(store.id, {
      phone: "+5511987654321",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    await app.request(`/api/customer/${customer.id}/archive`, {
      method: "POST",
    });

    const again = await findOrCreate(app, {
      storeId: store.id,
      phone: "11987654321",
    });
    expect(again.status).toBe(200);

    const body = (await again.json()) as FindOrCreateBody;
    expect(body.customer.id).toBe(customer.id);
    expect(body.created).toBe(false);

    const [row] = await db
      .select({ value: count() })
      .from(schema.customerTable)
      .where(eq(schema.customerTable.storeId, store.id));
    expect(Number(row?.value)).toBe(1);
  });

  describe("list", () => {
    it("searches by exact normalized phone or by name", async () => {
      const { user, store } = await createStoreOwner();
      const joana = await createCustomer(store.id, {
        name: "Joana Silva",
        phone: "+5511987654321",
      });
      await createCustomer(store.id, {
        name: "Bruno Costa",
        phone: "+5511911112222",
      });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const byPhone = await app.request(
        `/api/customer?storeId=${store.id}&q=1187654321`,
      );
      const byPhoneBody = (await byPhone.json()) as { items: CustomerRow[] };
      expect(byPhoneBody.items.map((item) => item.id)).toEqual([joana.id]);

      const byName = await app.request(
        `/api/customer?storeId=${store.id}&q=joana`,
      );
      const byNameBody = (await byName.json()) as { items: CustomerRow[] };
      expect(byNameBody.items.map((item) => item.id)).toEqual([joana.id]);

      const noMatch = await app.request(
        `/api/customer?storeId=${store.id}&q=zzzz`,
      );
      const noMatchBody = (await noMatch.json()) as { items: CustomerRow[] };
      expect(noMatchBody.items).toHaveLength(0);
    });

    it("treats a LIKE wildcard as a literal", async () => {
      const { user, store } = await createStoreOwner();
      await createCustomer(store.id, { name: "Ana" });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const response = await app.request(
        `/api/customer?storeId=${store.id}&q=%25`,
      );
      const body = (await response.json()) as { items: CustomerRow[] };
      expect(body.items).toHaveLength(0);
    });

    it("pages by cursor without repeating or dropping a row", async () => {
      const { user, store } = await createStoreOwner();

      for (let index = 0; index < 5; index += 1) {
        await createCustomer(store.id, { name: `Cliente ${index}` });
      }

      mockAuthenticatedSession(user);
      const { app } = createApp();

      const seen: string[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 5; page += 1) {
        const url = `/api/customer?storeId=${store.id}&limit=2${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`;
        const response = await app.request(url);
        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          items: CustomerRow[];
          nextCursor: string | null;
        };
        seen.push(...body.items.map((item) => item.id));
        cursor = body.nextCursor;

        if (!cursor) {
          break;
        }
      }

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
      expect(cursor).toBeNull();
    });

    it("rejects a malformed cursor and an out-of-range limit", async () => {
      const { user, store } = await createStoreOwner();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const badCursor = await app.request(
        `/api/customer?storeId=${store.id}&cursor=not-a-cursor`,
      );
      expect(badCursor.status).toBe(400);

      const badLimit = await app.request(
        `/api/customer?storeId=${store.id}&limit=999`,
      );
      expect(badLimit.status).toBe(400);
    });
  });
});
