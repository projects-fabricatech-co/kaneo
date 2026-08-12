import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  billingClientUrl,
  billingUnavailableError,
  getPriceId,
  isBillingConfigured,
  resolvePrice,
} from "../../../apps/fidelidade-api/src/billing/config";

/**
 * Every value is stubbed explicitly. A unit test that read the real environment
 * would pass or fail depending on whether the machine running it happens to have
 * Stripe keys, and would drag the repository's `.env` into the assertions.
 */
function stubConfiguredBilling() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit");
  vi.stubEnv("STRIPE_PRICE_ESSENCIAL_MONTHLY", "price_essencial_mensal");
  vi.stubEnv("STRIPE_PRICE_ESSENCIAL_ANNUAL", "price_essencial_anual");
  vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_mensal");
  vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "price_pro_anual");
  vi.stubEnv("FIDELIDADE_CLIENT_URL", "https://app.fidelidade.test");
}

describe("billing config", () => {
  beforeEach(() => {
    stubConfiguredBilling();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps plan + interval to a price id", () => {
    expect(getPriceId("essencial", "monthly")).toBe("price_essencial_mensal");
    expect(getPriceId("essencial", "annual")).toBe("price_essencial_anual");
    expect(getPriceId("pro", "monthly")).toBe("price_pro_mensal");
    expect(getPriceId("pro", "annual")).toBe("price_pro_anual");
  });

  it("maps a price id back to the same plan + interval", () => {
    expect(resolvePrice("price_essencial_mensal")).toEqual({
      plan: "essencial",
      interval: "monthly",
    });
    expect(resolvePrice("price_pro_anual")).toEqual({
      plan: "pro",
      interval: "annual",
    });
  });

  it("does NOT turn an unconfigured price id into a plan", () => {
    expect(resolvePrice("price_de_outro_produto")).toBeNull();
    expect(resolvePrice("")).toBeNull();
    expect(resolvePrice(null)).toBeNull();
    expect(resolvePrice(undefined)).toBeNull();
  });

  it("reports billing as unconfigured when either key is missing", () => {
    expect(isBillingConfigured()).toBe(true);

    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(isBillingConfigured()).toBe(false);

    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_unit");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(isBillingConfigured()).toBe(false);
  });

  it("returns no price at all when the price vars are missing", () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "");
    expect(getPriceId("pro", "monthly")).toBeNull();
    expect(resolvePrice("price_pro_mensal")).toBeNull();
  });

  it("trims the trailing slash off the client URL", () => {
    vi.stubEnv("FIDELIDADE_CLIENT_URL", "https://app.fidelidade.test/");
    expect(billingClientUrl()).toBe("https://app.fidelidade.test");
    expect(`${billingClientUrl()}/planos`).toBe(
      "https://app.fidelidade.test/planos",
    );
  });

  it("answers 503 with a pt-BR JSON body when billing is off", async () => {
    const error = billingUnavailableError();

    expect(error).toBeInstanceOf(HTTPException);
    expect(error.status).toBe(503);

    const body = (await error.getResponse().json()) as Record<string, unknown>;
    expect(body.error).toBe("billing_not_configured");
    expect(body.message).toMatch(/Pagamentos/);
  });
});
