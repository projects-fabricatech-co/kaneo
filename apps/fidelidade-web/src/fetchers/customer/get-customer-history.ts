import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CustomerHistoryResponse = InferResponseType<
  (typeof client.customer)[":id"]["history"]["$get"]
>;

async function getCustomerHistory(customerId: string) {
  const response = await client.customer[":id"].history.$get({
    param: { id: customerId },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getCustomerHistory;
