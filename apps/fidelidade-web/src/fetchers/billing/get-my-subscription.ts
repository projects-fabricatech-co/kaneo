import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type MySubscription = InferResponseType<typeof client.billing.$get>;

async function getMySubscription(storeId: string | null) {
  const response = await client.billing.$get({
    query: storeId ? { storeId } : {},
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getMySubscription;
