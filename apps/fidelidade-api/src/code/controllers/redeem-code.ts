import redeemCouponRedemptionCtrl, {
  type RedeemCouponRedemptionResult,
} from "../../coupon/controllers/redeem-coupon-redemption";
import redeemRewardCtrl, {
  type RedeemRewardResult,
} from "../../reward/controllers/redeem-reward";
import { codeKindFromCode } from "../../utils/short-code";
import { invalidCodeError } from "../code-error";

export type RedeemCodeInput = {
  storeId: string;
  code: string;
  redeemedByUserId: string;
};

export type RedeemCodeResult =
  | RedeemRewardResult
  | RedeemCouponRedemptionResult;

/**
 * The write half of the single "Validar código" input, and the only place a code
 * is ever spent. Same dispatch as `validate-code`, so a code that validated
 * cannot fail here for being the wrong kind.
 *
 * Both branches spend with one conditional UPDATE against their own table and
 * raise the same 404/409/410 bodies, so the counter screen handles failure
 * identically whichever kind was typed.
 */
async function redeemCode(input: RedeemCodeInput): Promise<RedeemCodeResult> {
  const kind = codeKindFromCode(input.code);

  if (kind === "reward") {
    return redeemRewardCtrl(input);
  }

  if (kind === "coupon") {
    return redeemCouponRedemptionCtrl(input);
  }

  throw invalidCodeError();
}

export default redeemCode;
