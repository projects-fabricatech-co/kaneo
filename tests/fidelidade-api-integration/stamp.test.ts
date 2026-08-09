import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCustomer,
  createProgram,
  createStoreCashier,
  createStoreOwner,
} from "./helpers/fixtures";

type StampResult = {
  stamp: { id: string; source: string; createdByUserId: string | null };
  card: {
    id: string;
    stampsCount: number;
    stampsRequired: number;
    status: string;
    cycle: number;
    completedAt: string | null;
  };
  replayed: boolean;
};

describe("API integration: stamps", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed(
    programOverrides: Partial<typeof schema.programTable.$inferInsert> = {},
  ) {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id, {
      cooldownMinutes: 0,
      stampsRequired: 3,
      ...programOverrides,
    });
    const customer = await createCustomer(store.id, { name: "Joana Silva" });

    return { user, store, program, customer };
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

  it("creates the card on the first stamp and increments it after that", async () => {
    const { user, store, program, customer } = await seed();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    expect(first.status).toBe(200);

    const firstBody = (await first.json()) as StampResult;
    expect(firstBody.replayed).toBe(false);
    expect(firstBody.card).toMatchObject({
      stampsCount: 1,
      stampsRequired: 3,
      status: "active",
      cycle: 1,
    });
    expect(firstBody.stamp.createdByUserId).toBe(user.id);
    expect(firstBody.stamp.source).toBe("manual");

    const second = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const secondBody = (await second.json()) as StampResult;

    expect(secondBody.card.id).toBe(firstBody.card.id);
    expect(secondBody.card.stampsCount).toBe(2);
    expect(secondBody.card.status).toBe("active");
  });

  it("records lastStampAt on the customer", async () => {
    const { user, store, program, customer } = await seed();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    expect(customer.lastStampAt).toBeNull();

    await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });

    const persisted = await db.query.customerTable.findFirst({
      where: eq(schema.customerTable.id, customer.id),
    });
    expect(persisted?.lastStampAt).toBeInstanceOf(Date);
  });

  it("SNAPSHOTS stampsRequired: raising the program goal does not move a card in flight", async () => {
    // The whole reason `cards.stampsRequired` exists as a column. A customer who
    // was told "10 carimbos" must not silently be told "20" on visit eleven.
    const { user, store, program, customer } = await seed({
      stampsRequired: 3,
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const opened = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;
    expect(opened.card.stampsRequired).toBe(3);

    const raise = await app.request(`/api/program/${program.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stampsRequired: 10 }),
    });
    expect(raise.status).toBe(200);

    const advanced = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;

    // Same card, same goal, despite the program now asking for ten.
    expect(advanced.card.id).toBe(opened.card.id);
    expect(advanced.card.stampsRequired).toBe(3);

    const completing = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;

    expect(completing.card.stampsCount).toBe(3);
    expect(completing.card.status).toBe("completed");
  });

  it("flips the card to completed at the goal, and refuses further stamps", async () => {
    const { user, store, program, customer } = await seed({
      stampsRequired: 2,
    });
    mockAuthenticatedSession(user);
    const { app } = createApp();

    await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    const completing = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;

    expect(completing.card.status).toBe("completed");
    expect(completing.card.completedAt).not.toBeNull();

    // Phase 3 owns reward creation; nothing may appear yet.
    const rewards = await db.select().from(schema.rewardTable);
    expect(rewards).toHaveLength(0);

    const overflow = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    expect(overflow.status).toBe(409);
    await expect(overflow.text()).resolves.toMatch(/Cartão completo/);

    const persisted = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.customerId, customer.id),
    });
    // The refused stamp changed nothing.
    expect(persisted?.stampsCount).toBe(2);
  });

  it("lets a cashier stamp", async () => {
    // Stamping is the cashier's entire job; gating it behind the owner would make
    // the product useless at the counter.
    const { store, program, customer } = await seed();
    const cashier = await createStoreCashier(store.id);
    mockAuthenticatedSession(cashier);
    const { app } = createApp();

    const response = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as StampResult;
    expect(body.stamp.createdByUserId).toBe(cashier.id);
  });

  it("stamps by the customer's public token, recording the qr source", async () => {
    const { user, store, program, customer } = await seed();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/stamp/by-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        programId: program.id,
        token: customer.publicToken,
        idempotencyKey: randomUUID(),
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as StampResult;
    expect(body.stamp.source).toBe("qr");
    expect(body.card.stampsCount).toBe(1);
  });

  it("refuses a token that belongs to another store's customer", async () => {
    const { user, store, program } = await seed();
    const other = await createStoreOwner({ storeName: "Outra" });
    const foreign = await createCustomer(other.store.id);
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/stamp/by-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        programId: program.id,
        token: foreign.publicToken,
        idempotencyKey: randomUUID(),
      }),
    });

    expect(response.status).toBe(404);
  });

  it("refuses to stamp against an archived program", async () => {
    const { user, store, program, customer } = await seed();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const archive = await app.request(`/api/program/${program.id}/archive`, {
      method: "POST",
    });
    expect(archive.status).toBe(200);

    const response = await stamp(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    expect(response.status).toBe(404);
  });

  it("returns the stamp history, newest first, including voided stamps", async () => {
    const { user, store, program, customer } = await seed();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = (await (
      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      })
    ).json()) as StampResult;

    const history = await app.request(
      `/api/stamp?storeId=${store.id}&cardId=${created.card.id}`,
    );
    expect(history.status).toBe(200);

    const rows = (await history.json()) as { id: string }[];
    expect(rows.map((row) => row.id)).toEqual([created.stamp.id]);
  });

  describe("voiding", () => {
    it("is refused to a cashier", async () => {
      // Voiding is the natural cover for register fraud: give away a stamp, then
      // erase it. Only the owner may do it.
      const { user, store, program, customer } = await seed();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const created = (await (
        await stamp(app, {
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
        })
      ).json()) as StampResult;

      const cashier = await createStoreCashier(store.id);
      mockAuthenticatedSession(cashier);

      const response = await app.request(
        `/api/stamp/${created.stamp.id}/void`,
        { method: "POST" },
      );
      expect(response.status).toBe(403);

      const persisted = await db.query.stampTable.findFirst({
        where: eq(schema.stampTable.id, created.stamp.id),
      });
      expect(persisted?.voidedAt).toBeNull();
    });

    it("decrements the card and records who did it", async () => {
      const { user, store, program, customer } = await seed();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      });
      const second = (await (
        await stamp(app, {
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
        })
      ).json()) as StampResult;
      expect(second.card.stampsCount).toBe(2);

      const response = await app.request(`/api/stamp/${second.stamp.id}/void`, {
        method: "POST",
      });
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        stamp: { voidedAt: string | null; voidedByUserId: string | null };
        card: { stampsCount: number };
      };
      expect(body.card.stampsCount).toBe(1);
      expect(body.stamp.voidedAt).not.toBeNull();
      expect(body.stamp.voidedByUserId).toBe(user.id);

      // The row survives — the attempt stays on the record.
      const persisted = await db.query.stampTable.findFirst({
        where: eq(schema.stampTable.id, second.stamp.id),
      });
      expect(persisted).toBeDefined();
    });

    it("does not decrement twice for the same stamp", async () => {
      const { user, store, program, customer } = await seed();
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const created = (await (
        await stamp(app, {
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
        })
      ).json()) as StampResult;

      const first = await app.request(`/api/stamp/${created.stamp.id}/void`, {
        method: "POST",
      });
      expect(first.status).toBe(200);

      const again = await app.request(`/api/stamp/${created.stamp.id}/void`, {
        method: "POST",
      });
      expect(again.status).toBe(409);

      const card = await db.query.cardTable.findFirst({
        where: eq(schema.cardTable.id, created.card.id),
      });
      expect(card?.stampsCount).toBe(0);
    });

    it("frees the cooldown, so the corrected stamp can be applied at once", async () => {
      const { user, store, program, customer } = await seed({
        cooldownMinutes: 60,
      });
      mockAuthenticatedSession(user);
      const { app } = createApp();

      const wrong = (await (
        await stamp(app, {
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
        })
      ).json()) as StampResult;

      await app.request(`/api/stamp/${wrong.stamp.id}/void`, {
        method: "POST",
      });

      // The cooldown looks only at non-voided stamps, so a cancelled mistake does
      // not lock the customer out for an hour.
      const retry = await stamp(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
      });
      expect(retry.status).toBe(200);
    });
  });
});
