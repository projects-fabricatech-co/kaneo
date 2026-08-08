import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type ListStoresResponse = InferResponseType<typeof client.store.$get>;

/** Every store the signed-in lojista is a member of. */
async function listStores() {
  // The route declares a `query` validator (includeArchived), so the client
  // requires the argument object even though every field is optional.
  const response = await client.store.$get({ query: {} });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();

  return data;
}

export default listStores;
