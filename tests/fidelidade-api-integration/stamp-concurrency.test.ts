import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCustomer,
  createProgram,
  createStoreOwner,
} from "./helpers/fixtures";

/**
 * The reason `create-stamp` exists in the shape it does.
 *
 * A cashier's phone on shop wifi double-taps buttons and retries requests. Two
 * people can be at the register at once. The invariant is that a customer's card
 * advances by exactly one stamp per genuine intent — never two, and never zero
 * because a retry was mistaken for an error.
 *
 * These tests are written against the app in-process with real concurrency
 * against real Postgres, which is the only way the advisory lock and the unique
 * index are actually exercised.
 */
describe("API integration: stamp concurrency", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed(cooldownMinutes: number) {
    const { user, store } = await createStoreOwner();
    const program = await createProgram(store.id, {
      cooldownMinutes,
      stampsRequired: 10,
    });
    const customer = await createCustomer(store.id, { name: "Joana" });

    mockAuthenticatedSession(user);

    return { user, store, program, customer, app: createApp().app };
  }

  function stampRequest(
    app: ReturnType<typeof createApp>["app"],
    body: Record<string, unknown>,
  ) {
    return app.request("/api/stamp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function countStamps(customerId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(schema.stampTable)
      .where(eq(schema.stampTable.customerId, customerId));

    return Number(row?.value ?? 0);
  }

  it("lets exactly one of two simultaneous stamps through when the keys differ", async () => {
    // Two different intents arriving together: the second is a genuine cooldown
    // violation, not a retry, so it must be refused — and the card must move by
    // one, not two.
    const { store, program, customer, app } = await seed(60);

    const [first, second] = await Promise.all([
      stampRequest(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey: randomUUID(),
      }),
      stampRequest(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey: randomUUID(),
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 429]);

    await expect(countStamps(customer.id)).resolves.toBe(1);

    const card = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.customerId, customer.id),
    });
    expect(card?.stampsCount).toBe(1);

    const refused = first.status === 429 ? first : second;
    const body = (await refused.json()) as Record<string, unknown>;

    // A JSON body, not HTTPException's plain text: the stamp screen shows a
    // countdown and keeps rendering the card.
    expect(body).toMatchObject({ error: "stamp_cooldown" });
    expect(typeof body.retryAfterSeconds).toBe("number");
    expect(body.retryAfterSeconds as number).toBeGreaterThan(0);
    expect(body.message as string).toMatch(/aguarde/i);
    expect(body.card).toMatchObject({ stampsCount: 1, stampsRequired: 10 });
    expect(refused.headers.get("Retry-After")).toBe(
      String(body.retryAfterSeconds),
    );
  });

  it("answers two simultaneous retries of the SAME request with two successes and one stamp", async () => {
    // The dropped-response case. Both callers must be told the stamp happened,
    // because it did — answering 429 to the retry would invent an error the
    // cashier then "fixes" by stamping again.
    const { store, program, customer, app } = await seed(60);
    const idempotencyKey = randomUUID();

    const responses = await Promise.all([
      stampRequest(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey,
      }),
      stampRequest(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    await expect(countStamps(customer.id)).resolves.toBe(1);

    const bodies = (await Promise.all(
      responses.map((response) => response.json()),
    )) as {
      stamp: { id: string };
      card: { stampsCount: number };
      replayed: boolean;
    }[];

    // Both describe the same stamp and the same card state.
    expect(bodies[0]?.stamp.id).toBe(bodies[1]?.stamp.id);
    expect(bodies.map((body) => body.card.stampsCount)).toEqual([1, 1]);

    // Exactly one of the two did the writing; the other reports a replay.
    expect(bodies.filter((body) => body.replayed)).toHaveLength(1);
  });

  it("replays a repeated key sequentially, long after the fact", async () => {
    const { store, program, customer, app } = await seed(60);
    const idempotencyKey = randomUUID();

    const first = await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey,
    });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ replayed: false });

    const retry = await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey,
    });

    // Inside the cooldown window, but a replay is not a violation.
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ replayed: true });
    await expect(countStamps(customer.id)).resolves.toBe(1);
  });

  it("allows back-to-back stamps with distinct keys when the cooldown is 0", async () => {
    const { store, program, customer, app } = await seed(0);

    for (const _ of [1, 2]) {
      const response = await stampRequest(app, {
        storeId: store.id,
        programId: program.id,
        customerId: customer.id,
        idempotencyKey: randomUUID(),
      });
      expect(response.status).toBe(200);
    }

    await expect(countStamps(customer.id)).resolves.toBe(2);

    const card = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.customerId, customer.id),
    });
    expect(card?.stampsCount).toBe(2);
  });

  it("still replays a key that is no longer the most recent stamp", async () => {
    // With the cooldown off, a retry can arrive after other stamps have landed,
    // so the "is this my own stamp?" shortcut does not fire and the unique index
    // on (cardId, idempotencyKey) is what catches it.
    const { store, program, customer, app } = await seed(0);
    const firstKey = randomUUID();

    await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey: firstKey,
    });
    await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey: randomUUID(),
    });

    const retry = await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey: firstKey,
    });

    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({ replayed: true });
    await expect(countStamps(customer.id)).resolves.toBe(2);
  });

  it("opens exactly one card when several stamps race on a brand new customer", async () => {
    // `cards_program_customer_live_unique` plus the advisory lock: five racing
    // requests must not create five cycle-1 cards.
    const { store, program, customer, app } = await seed(0);

    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        stampRequest(app, {
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
          idempotencyKey: randomUUID(),
        }),
      ),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);

    const [cards] = await db
      .select({ value: count() })
      .from(schema.cardTable)
      .where(eq(schema.cardTable.customerId, customer.id));
    expect(Number(cards?.value)).toBe(1);

    const card = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.customerId, customer.id),
    });
    expect(card?.stampsCount).toBe(5);
    expect(card?.cycle).toBe(1);
  });

  it("requires an idempotency key, and requires it to be a UUID", async () => {
    const { store, program, customer, app } = await seed(0);

    const missing = await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
    });
    expect(missing.status).toBe(400);

    const notAUuid = await stampRequest(app, {
      storeId: store.id,
      programId: program.id,
      customerId: customer.id,
      idempotencyKey: "carimbo-1",
    });
    expect(notAUuid.status).toBe(400);

    await expect(countStamps(customer.id)).resolves.toBe(0);
  });
});
