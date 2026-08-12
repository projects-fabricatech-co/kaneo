import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type StampsByDayResponse = InferResponseType<
  (typeof client.dashboard)["stamps-by-day"]["$get"]
>;

export const DEFAULT_CHART_DAYS = 14;

async function getStampsByDay(storeId: string, days = DEFAULT_CHART_DAYS) {
  const response = await client.dashboard["stamps-by-day"].$get({
    // The API validates `days` as a numeric string, so it is serialized here
    // rather than sent as a number.
    query: { storeId, days: String(days) },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getStampsByDay;
