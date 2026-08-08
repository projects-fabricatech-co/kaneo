import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type GetStoreRequest = InferRequestType<
  (typeof client.store)[":id"]["$get"]
>["param"];

async function getStore({ id }: GetStoreRequest) {
  const response = await client.store[":id"].$get({
    param: { id },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();

  return data;
}

export default getStore;
