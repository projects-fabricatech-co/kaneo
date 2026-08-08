import { describe, expect, it } from "vitest";
import {
  isPlanId,
  PLAN_IDS,
  PLAN_LABELS,
  PLAN_LIMITS,
  type PlanId,
} from "../../../apps/fidelidade-api/src/plans/limits";

describe("PLAN_LIMITS", () => {
  it("defines limits and a label for every plan id", () => {
    for (const plan of PLAN_IDS) {
      expect(PLAN_LIMITS[plan]).toBeDefined();
      expect(PLAN_LABELS[plan]).toBeTruthy();
    }
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual([...PLAN_IDS].sort());
  });

  it("matches the advertised Grátis plan", () => {
    // The landing page and the 402 copy both promise these numbers.
    expect(PLAN_LIMITS.gratis).toMatchObject({
      maxStores: 1,
      maxProgramsPerStore: 1,
      maxCustomersPerStore: 50,
      coupons: false,
      branding: false,
    });
  });

  it("gives paid plans unlimited customers", () => {
    expect(PLAN_LIMITS.essencial.maxCustomersPerStore).toBeNull();
    expect(PLAN_LIMITS.pro.maxCustomersPerStore).toBeNull();
  });

  it("only lets Pro run more than one store", () => {
    expect(PLAN_LIMITS.gratis.maxStores).toBe(1);
    expect(PLAN_LIMITS.essencial.maxStores).toBe(1);
    expect(PLAN_LIMITS.pro.maxStores).toBeGreaterThan(1);
  });

  it("gates coupons and branding behind a paid plan", () => {
    expect(PLAN_LIMITS.gratis.coupons).toBe(false);
    expect(PLAN_LIMITS.gratis.branding).toBe(false);
    expect(PLAN_LIMITS.essencial.coupons).toBe(true);
    expect(PLAN_LIMITS.essencial.branding).toBe(true);
  });

  it("reserves reports for Pro", () => {
    expect(PLAN_LIMITS.gratis.reports).toBe(false);
    expect(PLAN_LIMITS.essencial.reports).toBe(false);
    expect(PLAN_LIMITS.pro.reports).toBe(true);
  });

  it("never decreases a numeric allowance as the plan gets more expensive", () => {
    const order: PlanId[] = ["gratis", "essencial", "pro"];
    const unlimited = Number.POSITIVE_INFINITY;

    for (let i = 1; i < order.length; i += 1) {
      const lower = PLAN_LIMITS[order[i - 1] as PlanId];
      const higher = PLAN_LIMITS[order[i] as PlanId];

      expect(higher.maxStores).toBeGreaterThanOrEqual(lower.maxStores);
      expect(higher.maxProgramsPerStore).toBeGreaterThanOrEqual(
        lower.maxProgramsPerStore,
      );
      expect(higher.maxMembersPerStore).toBeGreaterThanOrEqual(
        lower.maxMembersPerStore,
      );
      expect(higher.maxCustomersPerStore ?? unlimited).toBeGreaterThanOrEqual(
        lower.maxCustomersPerStore ?? unlimited,
      );
    }
  });

  it("never revokes a boolean feature as the plan gets more expensive", () => {
    const order: PlanId[] = ["gratis", "essencial", "pro"];

    for (const feature of ["coupons", "branding", "reports"] as const) {
      for (let i = 1; i < order.length; i += 1) {
        const lower = PLAN_LIMITS[order[i - 1] as PlanId][feature];
        const higher = PLAN_LIMITS[order[i] as PlanId][feature];
        expect(Number(higher)).toBeGreaterThanOrEqual(Number(lower));
      }
    }
  });
});

describe("isPlanId", () => {
  it("accepts the known plans", () => {
    for (const plan of PLAN_IDS) {
      expect(isPlanId(plan)).toBe(true);
    }
  });

  it("rejects anything else, including values that could come from the DB", () => {
    for (const bad of [
      "",
      "free",
      "PRO",
      "enterprise",
      null,
      undefined,
      1,
      {},
    ]) {
      expect(isPlanId(bad)).toBe(false);
    }
  });
});
