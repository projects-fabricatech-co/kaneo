import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type FindOrCreateCustomerRequest = InferRequestType<
  typeof client.customer.$post
>["json"];

/**
 * Idempotent by (store, normalized phone). Returning an existing customer never
 * touches the plan limit — only creating a new one can answer 402.
 */
async function findOrCreateCustomer(input: FindOrCreateCustomerRequest) {
  const response = await client.customer.$post({ json: input });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default findOrCreateCustomer;
