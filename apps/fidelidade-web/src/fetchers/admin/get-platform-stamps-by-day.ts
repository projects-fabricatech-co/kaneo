import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type PlatformStampsByDay = InferResponseType<
  (typeof client.admin.metrics)["stamps-by-day"]["$get"]
>;

async function getPlatformStampsByDay(days?: number) {
  const response = await client.admin.metrics["stamps-by-day"].$get({
    query: days ? { days: String(days) } : {},
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getPlatformStampsByDay;
