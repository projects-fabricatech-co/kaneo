import { describe, expect, it } from "vitest";
import { effectivePlan } from "../../../apps/fidelidade-api/src/plans/resolve-plan";

type Sub = Parameters<typeof effectivePlan>[0];

function sub(overrides: Partial<NonNullable<Sub>>): NonNullable<Sub> {
  return {
    plan: "pro",
    status: "active",
    trialEndsAt: null,
    ...overrides,
  } as NonNullable<Sub>;
}

const HOUR = 60 * 60 * 1000;

describe("effectivePlan", () => {
  it("falls back to gratis with no subscription row", () => {
    expect(effectivePlan(null)).toBe("gratis");
  });

  it("grants the plan while the Stripe status entitles it", () => {
    expect(effectivePlan(sub({ plan: "pro", status: "active" }))).toBe("pro");
    expect(effectivePlan(sub({ plan: "essencial", status: "trialing" }))).toBe(
      "essencial",
    );
    // A failed card must not lock a lojista out mid-shift; dunning is Stripe's job.
    expect(effectivePlan(sub({ plan: "pro", status: "past_due" }))).toBe("pro");
  });

  it("downgrades to gratis when the subscription has lapsed", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]) {
      expect(effectivePlan(sub({ plan: "pro", status }))).toBe("gratis");
    }
  });

  it("honours a live trial even when the status does not entitle", () => {
    expect(
      effectivePlan(
        sub({
          plan: "pro",
          status: "incomplete",
          trialEndsAt: new Date(Date.now() + HOUR),
        }),
      ),
    ).toBe("pro");
  });

  it("ignores an expired trial", () => {
    expect(
      effectivePlan(
        sub({
          plan: "pro",
          status: "canceled",
          trialEndsAt: new Date(Date.now() - HOUR),
        }),
      ),
    ).toBe("gratis");
  });

  it("refuses to trust an unknown plan value from the database", () => {
    expect(effectivePlan(sub({ plan: "enterprise", status: "active" }))).toBe(
      "gratis",
    );
    expect(effectivePlan(sub({ plan: "", status: "active" }))).toBe("gratis");
  });

  it("is pure: it does not depend on Stripe being configured", () => {
    // Limits must behave identically before and after the keys arrive, so this
    // function reads only the row it is given.
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    expect(effectivePlan(sub({ plan: "pro", status: "active" }))).toBe("pro");
    if (saved !== undefined) {
      process.env.STRIPE_SECRET_KEY = saved;
    }
  });
});
