import inspectRewardCtrl, {
  type InspectRewardResult,
} from "../../reward/controllers/inspect-reward";
import { codeKindFromCode } from "../../utils/short-code";
import { couponNotAvailableError, invalidCodeError } from "../code-error";

export type ValidateCodeResult = InspectRewardResult;

/**
 * The read half of the single "Validar código" input. The lojista types whatever
 * the customer shows — a prize code or a coupon code — and the first character
 * decides which namespace it belongs to, which is exactly why the two prefixes
 * exist.
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

  // ── PHASE 4 EXTENSION POINT ──────────────────────────────────────────────
  // `C` codes are coupon redemptions. Phase 4 replaces this branch with
  // `inspectCouponRedemption(storeId, code)`, returning the same shape with
  // `kind: "coupon"`. Until then a valid coupon code gets an honest "ainda não
  // disponível" instead of a "não encontrado" that would send the lojista
  // hunting for a typo that is not there.
  // ─────────────────────────────────────────────────────────────────────────
  if (kind === "coupon") {
    throw couponNotAvailableError();
  }

  throw invalidCodeError();
}

export default validateCode;
