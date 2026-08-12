import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CreateStampRequest = InferRequestType<
  typeof client.stamp.$post
>["json"];

/**
 * `idempotencyKey` must be generated once PER TAP by the caller — not per render
 * and not per mount. A memoized key would make two genuine consecutive purchases
 * collapse into a single stamp.
 */
async function createStamp(input: CreateStampRequest) {
  const response = await client.stamp.$post({ json: input });

  if (!response.ok) {
    // 429 is the cooldown and carries `retryAfterSeconds` plus the card state;
    // 409 means the card is complete and needs redeeming first.
    throw await apiError(response);
  }

  return response.json();
}

export default createStamp;
