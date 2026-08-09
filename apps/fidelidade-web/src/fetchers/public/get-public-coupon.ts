import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type PublicCoupon = InferResponseType<
  (typeof client.public.coupon)[":token"]["$get"]
>;

/** The campaign landing page. Unauthenticated — the token is the only key. */
async function getPublicCoupon(token: string) {
  const response = await client.public.coupon[":token"].$get({
    param: { token },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default getPublicCoupon;
