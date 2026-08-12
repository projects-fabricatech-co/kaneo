import { randomInt } from "node:crypto";

/**
 * Codes are read aloud and typed by a cashier, so the alphabet drops every
 * glyph that gets confused in that setting: the digits 0 and 1, and the letters
 * I, L, O and U. (U goes too, which keeps the set from spelling unfortunate
 * things in Portuguese.)
 *
 * 30 characters, not a power of two, and that is fine: `randomInt` rejection
 * samples, so an arbitrary range is still unbiased. 30^6 is ~729 million codes
 * per store, against a realistic ceiling of a few thousand live at once.
 */
export const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const SHORT_CODE_BODY_LENGTH = 6;

export type CodeKind = "reward" | "coupon";

/**
 * `P` for prêmio, `C` for cupom. A single "Validate code" input can dispatch on
 * `code[0]`, and the two namespaces are provably disjoint.
 */
export const CODE_PREFIXES: Record<CodeKind, string> = {
  reward: "P",
  coupon: "C",
};

export function generateShortCode(kind: CodeKind): string {
  let body = "";

  for (let index = 0; index < SHORT_CODE_BODY_LENGTH; index += 1) {
    body += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)];
  }

  return `${CODE_PREFIXES[kind]}${body}`;
}

export function codeKindFromCode(code: string): CodeKind | null {
  const prefix = code.trim().toUpperCase()[0];

  if (prefix === CODE_PREFIXES.reward) {
    return "reward";
  }

  if (prefix === CODE_PREFIXES.coupon) {
    return "coupon";
  }

  return null;
}
