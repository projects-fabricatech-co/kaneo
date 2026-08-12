import { HTTPException } from "hono/http-exception";

/**
 * The three shapes a discount can take, and the rules that keep the pair
 * (`discountType`, `discountValue`) from ever being nonsense in the database.
 *
 * Kept OUT of the valibot schemas on purpose: the rule is cross-field, and `PUT`
 * has to apply it to the MERGE of the stored row and a partial body, which a
 * request-body schema cannot see. One function, two call sites, one truth.
 */

export type DiscountType = "percent" | "amount" | "freebie";

/** R$ 100.000,00. A typo in centavos is otherwise indistinguishable from intent. */
export const MAX_DISCOUNT_AMOUNT_CENTAVOS = 10_000_000;

export type DiscountInput = {
  discountType: DiscountType;
  /** Percent points for `percent`, centavos for `amount`, absent for `freebie`. */
  discountValue?: number | null;
  /** What the customer reads. Derived when the lojista leaves it blank. */
  discountLabel?: string | null;
};

export type ResolvedDiscount = {
  discountType: DiscountType;
  discountValue: number | null;
  discountLabel: string;
};

function discountError(message: string): HTTPException {
  return new HTTPException(400, { message });
}

/** 1000 -> "R$ 10", 1550 -> "R$ 15,50". */
export function formatCentavos(centavos: number): string {
  const reais = Math.trunc(centavos / 100);
  const cents = centavos % 100;

  return cents === 0
    ? `R$ ${reais}`
    : `R$ ${reais},${String(cents).padStart(2, "0")}`;
}

function defaultLabel(type: DiscountType, value: number | null): string {
  if (type === "percent" && value !== null) {
    return `${value}% OFF`;
  }

  if (type === "amount" && value !== null) {
    return `${formatCentavos(value)} OFF`;
  }

  return "Brinde";
}

/**
 * Validates the discount and fills in the label. Throws 400 with a pt-BR message
 * the lojista can act on, never a database constraint error.
 */
export function resolveDiscount(input: DiscountInput): ResolvedDiscount {
  const { discountType } = input;
  const value = input.discountValue ?? null;

  if (discountType === "freebie") {
    // Not merely ignored: a freebie carrying a number is a lojista who thinks
    // they set a value, and the counter would silently disagree with them.
    if (value !== null) {
      throw discountError("Um brinde não tem valor de desconto");
    }
  } else {
    if (value === null) {
      throw discountError("Informe o valor do desconto");
    }

    if (!Number.isInteger(value)) {
      throw discountError("Informe um número inteiro");
    }

    if (discountType === "percent" && (value < 1 || value > 100)) {
      throw discountError("O desconto em porcentagem deve ser de 1% a 100%");
    }

    if (
      discountType === "amount" &&
      (value < 1 || value > MAX_DISCOUNT_AMOUNT_CENTAVOS)
    ) {
      throw discountError(
        `O desconto em reais deve ser de R$ 0,01 a ${formatCentavos(
          MAX_DISCOUNT_AMOUNT_CENTAVOS,
        )}`,
      );
    }
  }

  const label = input.discountLabel?.trim();

  return {
    discountType,
    discountValue: discountType === "freebie" ? null : value,
    discountLabel: label ? label : defaultLabel(discountType, value),
  };
}
