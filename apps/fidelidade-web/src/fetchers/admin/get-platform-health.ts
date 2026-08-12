import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type PlatformHealth = InferResponseType<typeof client.admin.health.$get>;

async function getPlatformHealth() {
  const response = await client.admin.health.$get();

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getPlatformHealth;
