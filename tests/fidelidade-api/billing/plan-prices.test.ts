import { describe, expect, it } from "vitest";
import {
  BILLING_INTERVALS,
  monthlyRevenueCents,
  PAID_PLAN_IDS,
  PLAN_PRICE_CENTS,
} from "../../../apps/fidelidade-api/src/billing/config";

/**
 * The arithmetic behind the MRR tile.
 *
 * Not read from the environment like the rest of `config.ts`: these are the
 * prices themselves, and a test that stubbed them would assert that arithmetic
 * works rather than that the platform charges what it thinks it charges.
 */
describe("monthlyRevenueCents", () => {
  it("passes a monthly price straight through", () => {
    expect(monthlyRevenueCents("essencial", "monthly")).toBe(1999);
    expect(monthlyRevenueCents("pro", "monthly")).toBe(4990);
  });

  /**
   * The whole point of dividing. An annual plan counted whole would spike MRR by
   * R$ 499 in the month somebody renews and hold it flat for eleven months — a
   * cash-flow diary wearing the label of a rate.
   */
  it("spreads an annual price across twelve months", () => {
    expect(monthlyRevenueCents("essencial", "annual")).toBe(
      Math.round(19990 / 12),
    );
    expect(monthlyRevenueCents("pro", "annual")).toBe(Math.round(49900 / 12));
  });

  it("always returns whole centavos", () => {
    for (const plan of PAID_PLAN_IDS) {
      for (const interval of BILLING_INTERVALS) {
        expect(Number.isInteger(monthlyRevenueCents(plan, interval))).toBe(
          true,
        );
      }
    }
  });

  /** Annual is a discount, or the plans screen is lying about why to pick it. */
  it("prices the annual plan below twelve months of the monthly one", () => {
    for (const plan of PAID_PLAN_IDS) {
      expect(PLAN_PRICE_CENTS[plan].annual).toBeLessThan(
        PLAN_PRICE_CENTS[plan].monthly * 12,
      );
    }
  });

  it("covers every paid plan and interval, so a new plan cannot ship priceless", () => {
    for (const plan of PAID_PLAN_IDS) {
      for (const interval of BILLING_INTERVALS) {
        expect(PLAN_PRICE_CENTS[plan][interval]).toBeGreaterThan(0);
      }
    }
  });
});
