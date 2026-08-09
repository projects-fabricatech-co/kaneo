import { describe, expect, it } from "vitest";
import { apiError, isPlanLimitError } from "./api-error";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiError", () => {
  it("recognizes a counted plan ceiling", async () => {
    const error = await apiError(
      jsonResponse(402, {
        error: "plan_limit_exceeded",
        limit: "maxCustomersPerStore",
        max: 50,
        used: 50,
        plan: "gratis",
        message: "Seu plano Grátis permite até 50 clientes.",
      }),
    );

    expect(isPlanLimitError(error)).toBe(true);
    if (!isPlanLimitError(error)) return;
    expect(error.used).toBe(50);
    expect(error.message).toContain("50 clientes");
  });

  it("recognizes a feature the plan does not include", async () => {
    // The API has TWO 402 shapes and the feature one carries no max/used.
    // Matching only `plan_limit_exceeded` would drop coupons, branding and
    // reports into the generic-error path and never open the upgrade sheet.
    const error = await apiError(
      jsonResponse(402, {
        error: "plan_feature_unavailable",
        limit: "coupons",
        plan: "gratis",
        message: "Cupons e campanhas não está disponível no plano Grátis.",
      }),
    );

    expect(isPlanLimitError(error)).toBe(true);
    if (!isPlanLimitError(error)) return;
    expect(error.limit).toBe("coupons");
    expect(error.max).toBeUndefined();
  });

  it("keeps a plain-text error readable instead of showing raw JSON", async () => {
    const error = await apiError(
      new Response("Cliente não encontrado", { status: 404 }),
    );

    expect(isPlanLimitError(error)).toBe(false);
    expect(error.message).toBe("Cliente não encontrado");
  });

  it("prefers the server's message over the raw body for a JSON error", async () => {
    const error = await apiError(
      jsonResponse(400, { message: "Informe o valor do desconto" }),
    );

    expect(error.message).toBe("Informe o valor do desconto");
  });

  it("falls back to the status text when the body is empty", async () => {
    const error = await apiError(
      new Response("", { status: 500, statusText: "Internal Server Error" }),
    );

    expect(error.message).toBe("Internal Server Error");
  });

  it("does not treat a 402 with an unknown body as a plan error", async () => {
    const error = await apiError(
      jsonResponse(402, { error: "algo_outro", message: "Falha no pagamento" }),
    );

    expect(isPlanLimitError(error)).toBe(false);
    expect(error.message).toBe("Falha no pagamento");
  });
});
