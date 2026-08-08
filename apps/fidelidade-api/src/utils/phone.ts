import { HTTPException } from "hono/http-exception";

/**
 * Single source of truth for phone handling. Every phone that reaches the
 * database goes through `normalizeBrPhone`, so `(customers.storeId, phone)`
 * unique constraint actually means "one row per person".
 */

function normalizeOrNull(input: string): string | null {
  let digits = input.replace(/\D/g, "");

  // Country code: "+55 11 98765-4321" and "5511987654321" are the same number.
  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  // Legacy trunk prefix: "011 98765-4321".
  if (
    digits.startsWith("0") &&
    (digits.length === 11 || digits.length === 12)
  ) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return null;
  }

  const ddd = Number(digits.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) {
    return null;
  }

  // 9th-digit rule: mobile numbers written the old way ("11 8765-4321") gain a
  // leading 9. Without this the same person gets stored twice.
  if (digits.length === 10) {
    const firstSubscriberDigit = Number(digits[2]);
    if (firstSubscriberDigit >= 6 && firstSubscriberDigit <= 9) {
      digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
    }
  }

  return `+55${digits}`;
}

export function normalizeBrPhone(input: string): string {
  const normalized = normalizeOrNull(input ?? "");

  if (!normalized) {
    throw new HTTPException(422, { message: "Telefone inválido" });
  }

  return normalized;
}

export function isValidBrPhone(input: string): boolean {
  return normalizeOrNull(input ?? "") !== null;
}

function splitE164(e164: string): { ddd: string; subscriber: string } | null {
  const digits = e164.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;

  if (local.length !== 10 && local.length !== 11) {
    return null;
  }

  return { ddd: local.slice(0, 2), subscriber: local.slice(2) };
}

/** "+5511987654321" -> "(11) *****-4321" */
export function maskBrPhone(e164: string): string {
  const parts = splitE164(e164);

  if (!parts) {
    return e164;
  }

  const last4 = parts.subscriber.slice(-4);
  const hidden = "*".repeat(parts.subscriber.length - 4);

  return `(${parts.ddd}) ${hidden}-${last4}`;
}

/** "+5511987654321" -> "(11) 98765-4321" */
export function formatBrPhone(e164: string): string {
  const parts = splitE164(e164);

  if (!parts) {
    return e164;
  }

  const splitAt = parts.subscriber.length - 4;

  return `(${parts.ddd}) ${parts.subscriber.slice(0, splitAt)}-${parts.subscriber.slice(splitAt)}`;
}
