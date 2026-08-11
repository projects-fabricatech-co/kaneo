import { CONSENTIMENTO_ATUAL } from "@/content/legal/consentimento";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

/**
 * The only unauthenticated write in the product. Idempotent by
 * (coupon, customer): claiming twice returns the same code rather than
 * consuming a second slot, so refreshing the page is safe.
 */
async function claimPublicCoupon(
  token: string,
  input: { phone: string; name?: string },
) {
  const response = await client.public.coupon[":token"].claim.$post({
    param: { token },
    // The version travels with the claim rather than being assumed by the
    // server, so the ledger records the text THIS bundle actually displayed —
    // a cached page showing an older wording must not be recorded as the new one.
    json: { ...input, consentVersion: CONSENTIMENTO_ATUAL.version },
  });

  if (!response.ok) {
    // 409 sold out, 402 the store hit its customer limit, 422 bad phone.
    throw await apiError(response);
  }

  return response.json();
}

export default claimPublicCoupon;
