export type PlanId = "gratis" | "essencial" | "pro";

export type PlanLimits = {
  maxStores: number;
  maxProgramsPerStore: number;
  /** `null` means unlimited. */
  maxCustomersPerStore: number | null;
  maxMembersPerStore: number;
  coupons: boolean;
  branding: boolean;
  reports: boolean;
};

export const PLAN_IDS = ["gratis", "essencial", "pro"] as const;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  gratis: {
    maxStores: 1,
    maxProgramsPerStore: 1,
    maxCustomersPerStore: 50,
    maxMembersPerStore: 1,
    coupons: false,
    branding: false,
    reports: false,
  },
  essencial: {
    maxStores: 1,
    maxProgramsPerStore: 3,
    maxCustomersPerStore: null,
    maxMembersPerStore: 2,
    coupons: true,
    branding: true,
    reports: false,
  },
  pro: {
    maxStores: 10,
    maxProgramsPerStore: 10,
    maxCustomersPerStore: null,
    maxMembersPerStore: 10,
    coupons: true,
    branding: true,
    reports: true,
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  gratis: "Grátis",
  essencial: "Essencial",
  pro: "Pro",
};

export type PlanFeature = "coupons" | "branding" | "reports";

export function isPlanId(value: unknown): value is PlanId {
  return (
    typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
  );
}
