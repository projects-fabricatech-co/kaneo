import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type ListCustomersResponse = InferResponseType<
  typeof client.customer.$get
>;
export type Customer = ListCustomersResponse["items"][number];

export type ListCustomersParams = {
  storeId: string;
  q?: string;
  cursor?: string;
};

async function listCustomers({ storeId, q, cursor }: ListCustomersParams) {
  const response = await client.customer.$get({
    // The API takes `q` and `cursor` as optional query params; sending them as
    // empty strings would search for "" and page from a bad cursor.
    query: {
      storeId,
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default listCustomers;
