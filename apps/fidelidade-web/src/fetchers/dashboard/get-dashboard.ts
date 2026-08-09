import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type DashboardSummary = InferResponseType<typeof client.dashboard.$get>;

async function getDashboard(storeId: string) {
  const response = await client.dashboard.$get({ query: { storeId } });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getDashboard;
