import redeemRewardCtrl, {
  type RedeemRewardResult,
} from "../../reward/controllers/redeem-reward";
import { codeKindFromCode } from "../../utils/short-code";
import { couponNotAvailableError, invalidCodeError } from "../code-error";

export type RedeemCodeInput = {
  storeId: string;
  code: string;
  redeemedByUserId: string;
};

export type RedeemCodeResult = RedeemRewardResult;

/**
 * The write half of the single "Validar código" input, and the only place a code
 * is ever spent. Same dispatch as `validate-code`, so a code that validated
 * cannot fail here for being the wrong kind.
 */
async function redeemCode(input: RedeemCodeInput): Promise<RedeemCodeResult> {
  const kind = codeKindFromCode(input.code);

  if (kind === "reward") {
    return redeemRewardCtrl(input);
  }

  // ── PHASE 4 EXTENSION POINT ──────────────────────────────────────────────
  // Phase 4 replaces this branch with `redeemCouponRedemption(input)`, which
  // owns its own conditional UPDATE against `coupon_redemptions` — the same
  // one-statement pattern as `redeem-reward.ts`, against
  // `coupon_redemptions_store_code_unique`.
  // ─────────────────────────────────────────────────────────────────────────
  if (kind === "coupon") {
    throw couponNotAvailableError();
  }

  throw invalidCodeError();
}

export default redeemCode;
