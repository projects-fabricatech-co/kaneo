import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CreateCouponRequest = InferRequestType<
  typeof client.coupon.$post
>["json"];

async function createCoupon(input: CreateCouponRequest) {
  const response = await client.coupon.$post({ json: input });

  if (!response.ok) {
    // 402 here is the plan gate: coupons are a paid-plan feature.
    throw await apiError(response);
  }

  return response.json();
}

export default createCoupon;
