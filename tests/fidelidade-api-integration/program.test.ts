import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProgram,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

type ProgramRow = {
  id: string;
  name: string;
  stampsRequired: number;
  rewardDescription: string;
  rewardValidityDays: number;
  cooldownMinutes: number;
  cardColor: string;
  cardTextColor: string;
  status: string;
};

describe("API integration: programs", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  function create(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/program", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a program with sensible defaults", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await create(app, {
      storeId: store.id,
      name: "Cartão do Café",
      rewardDescription: "10º café grátis",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ProgramRow;
    expect(body).toMatchObject({
      name: "Cartão do Café",
      rewardDescription: "10º café grátis",
      stampsRequired: 10,
      rewardValidityDays: 30,
      cooldownMinutes: 60,
      status: "active",
    });
  });

  it("returns a pt-BR 409 for a duplicate active name, not a raw Postgres error", async () => {
    // `programs_store_name_active_unique` is a PARTIAL index, so this conflict
    // cannot be handled with onConflictDoNothing and would otherwise escape as an
    // English 500.
    const { user, store } = await createStoreOwner({ plan: "pro" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await create(app, {
      storeId: store.id,
      name: "Cartão do Café",
      rewardDescription: "Um café",
    });
    expect(first.status).toBe(200);

    const duplicate = await create(app, {
      storeId: store.id,
      name: "Cartão do Café",
      rewardDescription: "Outro café",
    });

    expect(duplicate.status).toBe(409);
    await expect(duplicate.text()).resolves.toBe(
      "Já existe um programa ativo com este nome",
    );
  });

  it("frees the name once the program is archived", async () => {
    const { user, store } = await createStoreOwner({ plan: "pro" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = (await (
      await create(app, {
        storeId: store.id,
        name: "Promoção de Inverno",
        rewardDescription: "Um chocolate quente",
      })
    ).json()) as ProgramRow;

    const archive = await app.request(`/api/program/${first.id}/archive`, {
      method: "POST",
    });
    expect(archive.status).toBe(200);
    await expect(archive.json()).resolves.toMatchObject({
      status: "archived",
    });

    const again = await create(app, {
      storeId: store.id,
      name: "Promoção de Inverno",
      rewardDescription: "Um chocolate quente",
    });
    expect(again.status).toBe(200);
  });

  it("rejects the edges of every numeric field", async () => {
    const { user, store } = await createStoreOwner();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const invalid = [
      { stampsRequired: 0 },
      { stampsRequired: 101 },
      { stampsRequired: 2.5 },
      { cooldownMinutes: -1 },
      { cooldownMinutes: 1441 },
      { rewardValidityDays: 0 },
      { rewardValidityDays: 3651 },
      { cardColor: "vermelho" },
      { cardColor: "#FFF" },
      { cardTextColor: "#GGGGGG" },
    ];

    for (const patch of invalid) {
      const response = await create(app, {
        storeId: store.id,
        name: `Programa ${JSON.stringify(patch)}`,
        rewardDescription: "Um prêmio",
        ...patch,
      });
      expect(response.status, JSON.stringify(patch)).toBe(400);
    }

    const [row] = await db
      .select({ value: count() })
      .from(schema.programTable)
      .where(eq(schema.programTable.storeId, store.id));
    expect(Number(row?.value)).toBe(0);
  });

  it("accepts the extremes that are inside the range", async () => {
    const { user, store } = await createStoreOwner({ plan: "pro" });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const extremes = [
      { stampsRequired: 1, cooldownMinutes: 0, rewardValidityDays: 1 },
      { stampsRequired: 100, cooldownMinutes: 1440, rewardValidityDays: 3650 },
    ];

    for (const [index, patch] of extremes.entries()) {
      const response = await create(app, {
        storeId: store.id,
        name: `Extremo ${index}`,
        rewardDescription: "Um prêmio",
        ...patch,
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject(patch);
    }
  });

  it("lists active programs by default and archived ones on request", async () => {
    const { user, store } = await createStoreOwner();
    const active = await createProgram(store.id, { name: "Ativo" });
    const archived = await createProgram(store.id, {
      name: "Antigo",
      status: "archived",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const list = await app.request(`/api/program?storeId=${store.id}`);
    const items = (await list.json()) as ProgramRow[];
    expect(items.map((item) => item.id)).toEqual([active.id]);

    const all = await app.request(
      `/api/program?storeId=${store.id}&includeArchived=true`,
    );
    const allItems = (await all.json()) as ProgramRow[];
    expect(allItems.map((item) => item.id).sort()).toEqual(
      [active.id, archived.id].sort(),
    );
  });

  it("lets a cashier read but never write", async () => {
    const { store } = await createStoreOwner();
    const program = await createProgram(store.id);
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    // The stamp screen needs the goal and the colours.
    const read = await app.request(`/api/program/${program.id}`);
    expect(read.status).toBe(200);

    const list = await app.request(`/api/program?storeId=${store.id}`);
    expect(list.status).toBe(200);

    const created = await create(app, {
      storeId: store.id,
      name: "Programa do Caixa",
      rewardDescription: "Um prêmio",
    });
    expect(created.status).toBe(403);

    const updated = await app.request(`/api/program/${program.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stampsRequired: 1 }),
    });
    expect(updated.status).toBe(403);

    const archived = await app.request(`/api/program/${program.id}/archive`, {
      method: "POST",
    });
    expect(archived.status).toBe(403);
  });

  it("updates a program and leaves untouched fields alone", async () => {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id, {
      name: "Original",
      cooldownMinutes: 60,
      cardColor: "#123456",
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/program/${program.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cooldownMinutes: 0 }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      name: "Original",
      cooldownMinutes: 0,
      cardColor: "#123456",
    });
  });
});
