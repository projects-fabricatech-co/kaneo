import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type RedeemCodeRequest = InferRequestType<
  typeof client.code.redeem.$post
>["json"];

/**
 * The mutation. Irreversible: it marks the code spent and resets the customer's
 * card to a fresh cycle.
 */
async function redeemCode(input: RedeemCodeRequest) {
  const response = await client.code.redeem.$post({ json: input });

  if (!response.ok) {
    // 409 already redeemed, 410 expired, 404 not found — all JSON bodies.
    throw await apiError(response);
  }

  return response.json();
}

export default redeemCode;
