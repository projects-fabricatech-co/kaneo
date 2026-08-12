import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CreateStoreRequest = InferRequestType<
  typeof client.store.$post
>["json"];

async function createStore({ name, slug }: CreateStoreRequest) {
  const response = await client.store.$post({
    json: { name, slug },
  });

  if (!response.ok) {
    // A 402 here means the plan's store limit was reached — `apiError` turns it
    // into a PlanLimitError carrying the server's pt-BR message.
    throw await apiError(response);
  }

  const data = await response.json();

  return data;
}

export default createStore;
