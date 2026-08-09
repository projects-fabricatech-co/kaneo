import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type LookupCustomerResponse = InferResponseType<
  typeof client.customer.lookup.$get
>;

/**
 * Exact lookup by phone, for the stamp screen. The server normalizes the number
 * before matching, so an old-style 10-digit mobile finds the customer stored
 * with the 9th digit.
 */
async function lookupCustomer(storeId: string, phone: string) {
  const response = await client.customer.lookup.$get({
    query: { storeId, phone },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default lookupCustomer;
