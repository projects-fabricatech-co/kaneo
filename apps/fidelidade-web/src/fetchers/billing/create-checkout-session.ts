import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CheckoutInput = {
  plan: "essencial" | "pro";
  interval: "monthly" | "annual";
};

/**
 * A plan and a cycle, never a price id. The server resolves the real Stripe
 * price from its own environment — a client that can name the price it wants to
 * pay is a client that picks its own price.
 */
async function createCheckoutSession(input: CheckoutInput) {
  const response = await client.billing.checkout.$post({ json: input });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default createCheckoutSession;
