import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import type { PlanId } from "../../apps/fidelidade-api/src/plans/limits";
import { DEFAULT_BRAND_COLOR } from "../../apps/fidelidade-api/src/public/controllers/get-public-card";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCustomer,
  createProgram,
  createRewardWithCard,
  createStoreOwner,
} from "./helpers/fixtures";

/**
 * The highest-risk endpoint in the product: unauthenticated, addressed by a
 * token in a URL, and it returns tenant data. These tests are the contract for
 * what may leave the building — they assert the EXACT shape, not a subset, so
 * adding a field to the response is a deliberate act that breaks a test rather
 * than a quiet accident.
 */
describe("API integration: public card", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seed(
    options: {
      plan?: PlanId;
      logoUrl?: string;
      brandColor?: string;
      stamps?: number;
    } = {},
  ) {
    const { user, store } = await createStoreOwner({ plan: options.plan });

    await db
      .update(schema.storeTable)
      .set({
        logoUrl: options.logoUrl ?? "https://cdn.example.com/logo.png",
        brandColor: options.brandColor ?? "#00FF00",
        city: "São Paulo",
        state: "SP",
        whatsapp: "+5511999998888",
      })
      .where(eq(schema.storeTable.id, store.id));

    const program = await createProgram(store.id, {
      name: "Cartão Fidelidade Café",
      rewardDescription: "10º café grátis",
      stampsRequired: 10,
      cooldownMinutes: 0,
      cardColor: "#111111",
      cardTextColor: "#EEEEEE",
    });

    const customer = await createCustomer(store.id, {
      name: "Maria Aparecida da Silva",
      phone: "+5511987654321",
      notes: "Segredo comercial: sempre pede desconto",
    });

    if (options.stamps) {
      mockAuthenticatedSession(user);
      const { app } = createApp();

      for (let index = 0; index < options.stamps; index += 1) {
        const response = await app.request("/api/stamp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storeId: store.id,
            programId: program.id,
            customerId: customer.id,
            idempotencyKey: randomUUID(),
          }),
        });
        expect(response.status).toBe(200);
      }
    }

    return { user, store, program, customer };
  }

  it("serves the card to an anonymous caller with the exact documented shape", async () => {
    const { store, customer } = await seed({ plan: "pro", stamps: 3 });
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );

    expect(response.status).toBe(200);

    // The URL carries a secret, so no shared cache may keep a copy.
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");

    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual([
      "cards",
      "coupons",
      "customer",
      "rewards",
      "store",
      "token",
    ]);

    expect(Object.keys(body.store as object).sort()).toEqual([
      "brandColor",
      "city",
      "logoUrl",
      "name",
      "whatsapp",
    ]);

    expect(Object.keys(body.customer as object).sort()).toEqual([
      "firstName",
      "phoneMasked",
    ]);

    expect(body.token).toBe(customer.publicToken);
    expect(body.store).toMatchObject({
      name: store.name,
      city: "São Paulo",
      whatsapp: "+5511999998888",
    });

    // The FIRST token of the name only: enough to personalise the page, not
    // enough to identify the holder to whoever else has the link.
    expect(body.customer).toEqual({
      firstName: "Maria",
      phoneMasked: "(11) *****-4321",
    });

    const cards = body.cards as Record<string, unknown>[];
    expect(cards).toHaveLength(1);
    expect(Object.keys(cards[0] as object).sort()).toEqual([
      "cardColor",
      "cardTextColor",
      "cycle",
      "programName",
      "rewardDescription",
      "stampedAt",
      "stampsCount",
      "stampsRequired",
      "status",
    ]);

    expect(cards[0]).toMatchObject({
      programName: "Cartão Fidelidade Café",
      rewardDescription: "10º café grátis",
      stampsCount: 3,
      stampsRequired: 10,
      cardColor: "#111111",
      cardTextColor: "#EEEEEE",
      status: "active",
      cycle: 1,
    });

    // Timestamps only, no staff attribution.
    const stampedAt = cards[0]?.stampedAt as string[];
    expect(stampedAt).toHaveLength(3);
    for (const value of stampedAt) {
      expect(new Date(value).toISOString()).toBe(value);
    }

    // Three stamps of ten: nothing won yet. Phase 4 fills `coupons`.
    expect(body.rewards).toEqual([]);
    expect(body.coupons).toEqual([]);
  });

  describe("rewards", () => {
    async function seedWithReward(
      overrides: Parameters<typeof createRewardWithCard>[3] = {},
    ) {
      const { user, store } = await createStoreOwner({ plan: "pro" });
      const program = await createProgram(store.id, {
        stampsRequired: 1,
        rewardDescription: "10º café grátis",
      });
      const customer = await createCustomer(store.id, { name: "Maria" });
      const { reward } = await createRewardWithCard(
        store.id,
        program.id,
        customer.id,
        { description: "10º café grátis", ...overrides },
      );

      mockAnonymousSession();

      return { user, store, program, customer, reward, app: createApp().app };
    }

    async function fetchRewards(
      app: ReturnType<typeof createApp>["app"],
      token: string,
    ) {
      const response = await app.request(`/api/public/card/${token}`);
      const body = (await response.json()) as {
        rewards: Record<string, unknown>[];
      };
      return body.rewards;
    }

    it("shows a pending code, and exactly three fields of it", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { customer, reward, app } = await seedWithReward({ expiresAt });

      const rewards = await fetchRewards(app, customer.publicToken);

      expect(rewards).toHaveLength(1);
      // No id, no status, no cardId: the customer needs the code, what it is
      // worth, and until when. Nothing else may leave the building.
      expect(Object.keys(rewards[0] as object).sort()).toEqual([
        "code",
        "description",
        "expiresAt",
      ]);
      expect(rewards[0]).toEqual({
        code: reward.code,
        description: "10º café grátis",
        expiresAt: expiresAt.toISOString(),
      });
    });

    it("shows a code with no expiry as expiring never", async () => {
      const { customer, reward, app } = await seedWithReward({
        expiresAt: null,
      });

      const rewards = await fetchRewards(app, customer.publicToken);

      expect(rewards).toEqual([
        {
          code: reward.code,
          description: "10º café grátis",
          expiresAt: null,
        },
      ]);
    });

    it("hides a code that has already been redeemed", async () => {
      const { customer, reward, app } = await seedWithReward({
        status: "redeemed",
        redeemedAt: new Date(),
      });

      const rewards = await fetchRewards(app, customer.publicToken);

      expect(rewards).toEqual([]);
      // The row is still there; it is the rendering that withholds it.
      const persisted = await db.query.rewardTable.findFirst({
        where: eq(schema.rewardTable.id, reward.id),
      });
      expect(persisted?.status).toBe("redeemed");
    });

    it("hides a code that has expired", async () => {
      // A dead code on the customer's phone is a person walking in to be told
      // no. Better that it simply is not there.
      const { customer, app } = await seedWithReward({
        expiresAt: new Date(Date.now() - 60_000),
      });

      const rewards = await fetchRewards(app, customer.publicToken);

      expect(rewards).toEqual([]);
    });

    it("never shows another customer's code", async () => {
      const mine = await seedWithReward();
      const theirs = await seedWithReward();

      const response = await mine.app.request(
        `/api/public/card/${mine.customer.publicToken}`,
      );
      const raw = await response.text();

      expect(raw).toContain(mine.reward.code);
      expect(raw).not.toContain(theirs.reward.code);
    });
  });

  it("leaks no id, no raw phone, and nothing internal", async () => {
    const { store, program, customer } = await seed({ plan: "pro", stamps: 2 });
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const raw = await response.text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    const card = await db.query.cardTable.findFirst({
      where: eq(schema.cardTable.customerId, customer.id),
    });

    // No identifier of any kind appears anywhere in the payload.
    for (const id of [
      customer.id,
      store.id,
      program.id,
      card?.id ?? "",
      store.ownerUserId,
    ]) {
      expect(raw).not.toContain(id);
    }

    // Nor the raw phone, nor the shop's private notes about this person.
    expect(raw).not.toContain("+5511987654321");
    expect(raw).not.toContain("11987654321");
    expect(raw).not.toContain("Segredo comercial");
    expect(raw).not.toContain(store.slug);

    // Nor the key names, at any depth.
    const forbidden = [
      "phone",
      "customerId",
      "storeId",
      "programId",
      "cardId",
      "notes",
      "createdByUserId",
      "ownerUserId",
      "slug",
      "state",
      "id",
      "plan",
      "role",
      "email",
    ];

    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) {
          walk(item);
        }
        return;
      }
      if (typeof value === "object" && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          walk(child);
        }
      }
    };
    walk(body);

    for (const key of forbidden) {
      expect(keys).not.toContain(key);
    }
  });

  it("withholds custom branding on a plan that does not include it", async () => {
    // A store that lapsed from Essencial back to Grátis keeps its logo and colour
    // in the database, so the gate has to be applied when the page is rendered —
    // this is where the paid feature would otherwise leak for free.
    const { store, customer } = await seed({ plan: "gratis" });
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const body = (await response.json()) as {
      store: { logoUrl: string | null; brandColor: string };
    };

    expect(body.store.logoUrl).toBeNull();
    // Compared against the exported constant, not a literal: the fallback is a
    // brand decision that will move again, and a copy of it here would just go
    // stale silently.
    expect(body.store.brandColor).toBe(DEFAULT_BRAND_COLOR);
    expect(body.store.brandColor).not.toBe("#00FF00");

    const persisted = await db.query.storeTable.findFirst({
      where: eq(schema.storeTable.id, store.id),
    });
    // The store row itself is untouched: this is a rendering decision.
    expect(persisted?.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(persisted?.brandColor).toBe("#00FF00");
  });

  it("shows custom branding on a paid plan", async () => {
    const { customer } = await seed({ plan: "essencial" });
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const body = (await response.json()) as {
      store: { logoUrl: string | null; brandColor: string };
    };

    expect(body.store.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(body.store.brandColor).toBe("#00FF00");
  });

  it("404s an unknown token", async () => {
    await seed();
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/public/card/nao-existe");

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Cartão não encontrado");
  });

  it("404s an archived customer, with the same message as an unknown token", async () => {
    // The link is revoked; whether the customer ever existed is not the holder's
    // business.
    const { customer } = await seed();

    await db
      .update(schema.customerTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.customerTable.id, customer.id));

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Cartão não encontrado");
  });

  it("shows only the addressed store: store B's token never exposes store A", async () => {
    const a = await seed({ plan: "pro", stamps: 1 });
    const b = await seed({ plan: "pro", stamps: 1 });

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${b.customer.publicToken}`,
    );
    const raw = await response.text();
    const body = JSON.parse(raw) as { store: { name: string } };

    expect(response.status).toBe(200);
    expect(body.store.name).toBe(b.store.name);
    expect(body.store.name).not.toBe(a.store.name);
    expect(raw).not.toContain(a.store.name);
    expect(raw).not.toContain(a.store.id);
    expect(raw).not.toContain(a.customer.publicToken);
  });

  it("shows a customer with no card at all as an empty card list", async () => {
    const { customer } = await seed({ plan: "pro" });
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const body = (await response.json()) as { cards: unknown[] };

    expect(response.status).toBe(200);
    expect(body.cards).toEqual([]);
  });

  it("omits voided stamps from the timeline and from the count", async () => {
    const { user, store, program, customer } = await seed({
      plan: "pro",
      stamps: 2,
    });
    mockAuthenticatedSession(user);
    const authed = createApp().app;

    const [stamp] = await db
      .select()
      .from(schema.stampTable)
      .where(eq(schema.stampTable.customerId, customer.id))
      .limit(1);

    const voided = await authed.request(`/api/stamp/${stamp?.id}/void`, {
      method: "POST",
    });
    expect(voided.status).toBe(200);
    expect(program.id).toBeDefined();
    expect(store.id).toBeDefined();

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const body = (await response.json()) as {
      cards: { stampsCount: number; stampedAt: string[] }[];
    };

    expect(body.cards[0]?.stampsCount).toBe(1);
    expect(body.cards[0]?.stampedAt).toHaveLength(1);
  });

  it("caps the timeline at 30 instants", async () => {
    const { user, store } = await createStoreOwner({ plan: "pro" });
    const program = await createProgram(store.id, {
      stampsRequired: 100,
      cooldownMinutes: 0,
    });
    const customer = await createCustomer(store.id, { name: "Longa Fila" });

    mockAuthenticatedSession(user);
    const authed = createApp().app;

    for (let index = 0; index < 32; index += 1) {
      await authed.request("/api/stamp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          programId: program.id,
          customerId: customer.id,
          idempotencyKey: randomUUID(),
        }),
      });
    }

    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request(
      `/api/public/card/${customer.publicToken}`,
    );
    const body = (await response.json()) as {
      cards: { stampsCount: number; stampedAt: string[] }[];
    };

    expect(body.cards[0]?.stampsCount).toBe(32);
    expect(body.cards[0]?.stampedAt).toHaveLength(30);
  });
});
