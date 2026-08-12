import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type PlatformMetrics = InferResponseType<
  typeof client.admin.metrics.$get
>;

async function getPlatformMetrics() {
  const response = await client.admin.metrics.$get({ query: {} });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getPlatformMetrics;
