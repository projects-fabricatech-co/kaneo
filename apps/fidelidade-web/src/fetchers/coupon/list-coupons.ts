import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type ListCouponsResponse = InferResponseType<typeof client.coupon.$get>;
export type Coupon = ListCouponsResponse[number];

async function listCoupons(storeId: string) {
  const response = await client.coupon.$get({ query: { storeId } });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default listCoupons;
