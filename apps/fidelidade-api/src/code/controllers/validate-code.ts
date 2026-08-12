import inspectCouponRedemptionCtrl, {
  type InspectCouponRedemptionResult,
} from "../../coupon/controllers/inspect-coupon-redemption";
import inspectRewardCtrl, {
  type InspectRewardResult,
} from "../../reward/controllers/inspect-reward";
import { codeKindFromCode } from "../../utils/short-code";
import { invalidCodeError } from "../code-error";

export type ValidateCodeResult =
  | InspectRewardResult
  | InspectCouponRedemptionResult;

/**
 * The read half of the single "Validar código" input. The lojista types whatever
 * the customer shows — a prize code or a coupon code — and the first character
 * decides which namespace it belongs to, which is exactly why the two prefixes
 * exist.
 *
 * Both branches answer with the SAME shape, differing only in `kind`, so the
 * counter screen renders one result panel and changes nothing but the wording.
 *
 * Nothing here writes. Confirming what a code is worth has to be free, or the
 * lojista learns not to check.
 */
async function validateCode(
  storeId: string,
  code: string,
): Promise<ValidateCodeResult> {
  const kind = codeKindFromCode(code);

  if (kind === "reward") {
    return inspectRewardCtrl(storeId, code);
  }

  if (kind === "coupon") {
    return inspectCouponRedemptionCtrl(storeId, code);
  }

  throw invalidCodeError();
}

export default validateCode;
