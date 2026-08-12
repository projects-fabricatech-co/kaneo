import type { Context, Next } from "hono";
import type { PlanFeature } from "./limits";
import { planFeatureError } from "./plan-limit-error";
import { resolvePlanForStore } from "./resolve-plan";

/**
 * Boolean features have no count-then-insert race, so unlike `assertWithinLimit`
 * these are safe as middleware. Place last in the chain, after a
 * `storeAccess.*` middleware has set `storeId`.
 */
export function requireFeature(feature: PlanFeature) {
  return async (c: Context, next: Next) => {
    const storeId = c.get("storeId") as string | undefined;

    if (!storeId) {
      return next();
    }

    const { plan, limits } = await resolvePlanForStore(storeId);

    if (!limits[feature]) {
      throw planFeatureError(feature, plan);
    }

    return next();
  };
}
