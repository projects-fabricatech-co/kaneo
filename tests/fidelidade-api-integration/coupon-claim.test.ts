import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/fidelidade-api/src/database";
import { createApp } from "../../apps/fidelidade-api/src/index";
import { resetClaimRateLimit } from "../../apps/fidelidade-api/src/public/claim-rate-limit";
import { mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createCoupon,
  createCustomer,
  createStoreOwner,
  seedCustomers,
} from "./helpers/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * THE ONLY UNAUTHENTICATED WRITE IN THE PRODUCT, and the file that has to earn
 * it. Everything here runs real concurrent requests against real Postgres,
 * because the two claims this endpoint makes — a campaign cap that cannot be
 * overrun and a claim that is idempotent under a refresh — are both statements
 * about what two transactions do to each other, and nothing else can test that.
 *
 * The concurrency cases come FIRST on purpose. They are the reason the ordering
 * in `claim-public-coupon.ts` is what it is.
 */
describe("API integration: claiming a public coupon", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    // Module state, deliberately: the window outlives a single `createApp()`.
    resetClaimRateLimit();
    mockAnonymousSession();
  });

  async function seed(
    overrides: Partial<Parameters<typeof createCoupon>[1]> = {},
  ) {
    const { user, store } = await createStoreOwner({ plan: "essencial" });
    const coupon = await createCoupon(store.id, {
      title: "Semana do Cliente",
      ...overrides,
    });

    return { user, store, coupon, app: createApp().app };
  }

  function claim(
    app: ReturnType<typeof createApp>["app"],
    token: string,
    body: Record<string, unknown>,
  ) {
    return app.request(`/api/public/coupon/${token}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function couponRow(couponId: string) {
    return db.query.couponTable.findFirst({
      where: eq(schema.couponTable.id, couponId),
    });
  }

  async function countRedemptions(couponId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(schema.couponRedemptionTable)
      .where(eq(schema.couponRedemptionTable.couponId, couponId));

    return Number(row?.value ?? 0);
  }

  it("lets exactly one of eight simultaneous claims take the last coupon", async () => {
    // Eight different people scan the poster in the same second and there is
    // one coupon left. Seven of them must be told no, and the count must land
    // on exactly 1 — not 8, and not 1 with eight rows behind it.
    const { coupon, app } = await seed({ maxRedemptions: 1 });

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        claim(app, coupon.publicToken, { phone: `1198800${1000 + index}` }),
      ),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409, 409, 409]);

    expect((await couponRow(coupon.id))?.redemptionCount).toBe(1);
    expect(await countRedemptions(coupon.id)).toBe(1);

    const refused = responses.find((response) => response.status === 409);
    await expect(refused?.json()).resolves.toMatchObject({
      error: "coupon_sold_out",
      message: "Cupom esgotado",
    });
  });

  it("gives the same customer one code when they claim twice at the same instant", async () => {
    // The phone that double-taps, or the page that is refreshed mid-request.
    // Two slots consumed here would silently shrink the campaign every time
    // somebody is impatient.
    const { coupon, app } = await seed({ maxRedemptions: 5 });

    const responses = await Promise.all([
      claim(app, coupon.publicToken, { phone: "11988001234" }),
      claim(app, coupon.publicToken, { phone: "11988001234" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const bodies = (await Promise.all(
      responses.map((response) => response.json()),
    )) as { code: string }[];

    expect(bodies[0]?.code).toBe(bodies[1]?.code);

    expect((await couponRow(coupon.id))?.redemptionCount).toBe(1);
    expect(await countRedemptions(coupon.id)).toBe(1);
  });

  it("still hands the same customer their code when their own claim filled the campaign", async () => {
    // Same race as above, but the cap is 1: the second request finds the
    // campaign full and the row that filled it is its OWN. "Esgotado" would be
    // technically true and completely wrong.
    const { coupon, app } = await seed({ maxRedemptions: 1 });

    const responses = await Promise.all([
      claim(app, coupon.publicToken, { phone: "11988001234" }),
      claim(app, coupon.publicToken, { phone: "11988001234" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const bodies = (await Promise.all(
      responses.map((response) => response.json()),
    )) as { code: string }[];

    expect(bodies[0]?.code).toBe(bodies[1]?.code);
    expect((await couponRow(coupon.id))?.redemptionCount).toBe(1);
    expect(await countRedemptions(coupon.id)).toBe(1);
  });

  it("returns the same code on a refresh, without spending a second slot", async () => {
    const { coupon, app } = await seed({ maxRedemptions: 2 });

    const first = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });
    const second = await claim(app, coupon.publicToken, {
      phone: "(11) 98800-1234",
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = (await first.json()) as { code: string };
    const secondBody = (await second.json()) as { code: string };

    // The same person, written two different ways. The phone normalizer is what
    // makes those one customer, and the unique index is what makes them one code.
    expect(secondBody.code).toBe(firstBody.code);
    expect((await couponRow(coupon.id))?.redemptionCount).toBe(1);
  });

  it("still answers a customer who already holds a code after the campaign sold out", async () => {
    const { coupon, app } = await seed({ maxRedemptions: 1 });

    const mine = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });
    expect(mine.status).toBe(200);
    const mineBody = (await mine.json()) as { code: string };

    // Somebody else is refused...
    const other = await claim(app, coupon.publicToken, {
      phone: "11988009999",
    });
    expect(other.status).toBe(409);

    // ...and I can still open my own link.
    const again = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });
    expect(again.status).toBe(200);
    await expect(again.json()).resolves.toMatchObject({ code: mineBody.code });

    expect((await couponRow(coupon.id))?.redemptionCount).toBe(1);
  });

  it("enrols the claimer in the store's base and points them at their own card", async () => {
    // The product decision, asserted: a coupon is an acquisition channel. The
    // person leaves with a code AND a loyalty card.
    const { store, coupon, app } = await seed();

    const response = await claim(app, coupon.publicToken, {
      phone: "(11) 98800-1234",
      name: "Joana Souza",
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["cardUrl", "code", "expiresAt"]);
    expect(body.code as string).toMatch(/^C/);

    const customer = await db.query.customerTable.findFirst({
      where: eq(schema.customerTable.storeId, store.id),
    });

    expect(customer?.phone).toBe("+5511988001234");
    expect(customer?.name).toBe("Joana Souza");
    expect(body.cardUrl).toBe(
      `http://localhost:5174/c/${customer?.publicToken}`,
    );
  });

  it("recognises a phone already in the base instead of enrolling it twice", async () => {
    const { store, coupon, app } = await seed();

    const first = await claim(app, coupon.publicToken, {
      phone: "11988001234",
      name: "Joana",
    });
    expect(first.status).toBe(200);

    const second = await createCoupon(store.id, { title: "Outra campanha" });
    const response = await claim(app, second.publicToken, {
      phone: "11988001234",
    });
    expect(response.status).toBe(200);

    const [customers] = await db
      .select({ value: count() })
      .from(schema.customerTable)
      .where(eq(schema.customerTable.storeId, store.id));
    expect(Number(customers?.value)).toBe(1);

    // Two campaigns, two distinct codes for the same person.
    const firstBody = (await first.json()) as { code: string };
    const secondBody = (await response.json()) as { code: string };
    expect(secondBody.code).not.toBe(firstBody.code);
  });

  it("dates the code from the campaign's own validity", async () => {
    const { coupon, app } = await seed({ redemptionValidityDays: 3 });

    const response = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });

    const body = (await response.json()) as { expiresAt: string };
    const expiresAt = new Date(body.expiresAt).getTime();

    expect(expiresAt).toBeGreaterThan(Date.now() + 2.9 * DAY_MS);
    expect(expiresAt).toBeLessThan(Date.now() + 3.1 * DAY_MS);
  });

  it("treats a validity of zero as a code that never expires", async () => {
    const { coupon, app } = await seed({ redemptionValidityDays: 0 });

    const response = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });

    await expect(response.json()).resolves.toMatchObject({ expiresAt: null });
  });

  it("404s an archived campaign, an unstarted one and a token that never existed", async () => {
    const { store, app } = await seed();

    const archived = await createCoupon(store.id, { status: "archived" });
    const draft = await createCoupon(store.id, { status: "draft" });
    const later = await createCoupon(store.id, {
      startsAt: new Date(Date.now() + DAY_MS),
    });
    const over = await createCoupon(store.id, {
      endsAt: new Date(Date.now() - DAY_MS),
    });

    for (const token of [
      archived.publicToken,
      draft.publicToken,
      later.publicToken,
      over.publicToken,
      "nao-existe",
    ]) {
      const response = await claim(app, token, { phone: "11988001234" });
      expect(response.status).toBe(404);
      await expect(response.text()).resolves.toBe("Campanha não encontrada");
    }

    // Nothing was enrolled behind any of those refusals.
    const [customers] = await db
      .select({ value: count() })
      .from(schema.customerTable)
      .where(eq(schema.customerTable.storeId, store.id));
    expect(Number(customers?.value)).toBe(0);
  });

  it("422s a phone that is not a phone", async () => {
    const { coupon, app } = await seed();

    const response = await claim(app, coupon.publicToken, { phone: "123" });

    expect(response.status).toBe(422);
    await expect(response.text()).resolves.toBe("Telefone inválido");
    expect((await couponRow(coupon.id))?.redemptionCount).toBe(0);
  });

  it("402s the claim that would be the 51st customer on Grátis", async () => {
    // The plan ceiling still applies on the way in through a coupon — otherwise
    // the public link is a hole straight through it.
    const { store } = await createStoreOwner();
    const coupon = await createCoupon(store.id);
    await seedCustomers(store.id, 50);
    const { app } = createApp();

    const response = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: "plan_limit_exceeded",
      limit: "maxCustomersPerStore",
      plan: "gratis",
    });

    expect((await couponRow(coupon.id))?.redemptionCount).toBe(0);
    expect(await countRedemptions(coupon.id)).toBe(0);
  });

  it("dampens a flood from one address with a 429", async () => {
    // Not a security control — the header is spoofable and the window is in
    // memory. It exists so a stuck retry loop cannot drain a campaign.
    const { coupon, app } = await seed();

    const statuses: number[] = [];

    for (let index = 0; index < 18; index += 1) {
      const response = await app.request(
        `/api/public/coupon/${coupon.publicToken}/claim`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({ phone: `1198800${2000 + index}` }),
        },
      );
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 200)).toHaveLength(16);
    expect(statuses.slice(16)).toEqual([429, 429]);

    // A different address is unaffected: the window is per IP and campaign.
    const elsewhere = await app.request(
      `/api/public/coupon/${coupon.publicToken}/claim`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.4",
        },
        body: JSON.stringify({ phone: "11988003000" }),
      },
    );
    expect(elsewhere.status).toBe(200);
  });

  it("needs no session at all", async () => {
    const { coupon, app } = await seed();

    const response = await claim(app, coupon.publicToken, {
      phone: "11988001234",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
  });

  describe("the card link", () => {
    it("hands the card link ONLY to a customer this claim enrolled", async () => {
      const { coupon, app } = await seed();

      const first = await app.request(
        `/api/public/coupon/${coupon.publicToken}/claim`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: "11987654321" }),
        },
      );
      const firstBody = (await first.json()) as { cardUrl: string | null };

      expect(first.status).toBe(200);
      expect(firstBody.cardUrl).toBeTruthy();
    });

    it("withholds the card link from anyone claiming for an EXISTING customer", async () => {
      // The attack this closes: the campaign link is printed on a poster, so it
      // is not a secret. Someone who also knows a phone NUMBER — not proof of
      // owning the phone — used to receive that person's card link, and with it
      // their visit history and every live single-use reward code.
      const { coupon, app } = await seed();
      const phone = "11987654321";
      const claim = () =>
        app.request(`/api/public/coupon/${coupon.publicToken}/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        });

      const first = (await (await claim()).json()) as {
        code: string;
        cardUrl: string | null;
      };
      resetClaimRateLimit();
      const second = (await (await claim()).json()) as {
        code: string;
        cardUrl: string | null;
      };

      // The code is still theirs and still the same — it is unique per
      // (campaign, customer), so a repeat claimer can only ever see their own.
      expect(second.code).toBe(first.code);
      // The credential is not.
      expect(second.cardUrl).toBeNull();
    });

    it("never returns a token belonging to a customer enrolled by another route", async () => {
      const { store, coupon, app } = await seed();
      const existing = await createCustomer(store.id, {
        phone: "+5511987654321",
      });

      const response = await app.request(
        `/api/public/coupon/${coupon.publicToken}/claim`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: "11987654321" }),
        },
      );
      const body = (await response.json()) as { cardUrl: string | null };
      const raw = JSON.stringify(body);

      expect(body.cardUrl).toBeNull();
      expect(raw).not.toContain(existing.publicToken);
    });
  });
});
