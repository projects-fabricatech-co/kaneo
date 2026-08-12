/**
 * Display-only BR phone helpers.
 *
 * These NEVER decide whether a number is valid — the server owns validation.
 * All they do is make the digits readable while the lojista types on a phone
 * keypad at the counter.
 */

/** Strips everything that is not a digit, capped at 11 digits (DDD + 9). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * National digits (DDD + subscriber) from anything the server may hand us.
 *
 * The API stores E.164, so a stored number arrives as "+5511987654321" — 13
 * digits. `onlyDigits` caps at 11 for the typing mask, which would truncate the
 * subscriber number and render "(55) 11987-6543", so the country code has to come
 * off first.
 */
function nationalDigits(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    return digits.slice(2);
  }

  // Deliberately NOT truncated to 11 here. Truncating would turn a 15-digit
  // junk value into a plausible-looking phone number; leaving it long lets the
  // caller's length check reject it and show the raw value instead. The 11-digit
  // cap belongs to the typing mask, not to the formatter.
  return digits;
}

/**
 * Progressive input mask. Safe to call on every keystroke — partial input stays
 * partially masked so the caret never jumps ahead of the user.
 *
 *   ""            -> ""
 *   "11"          -> "(11"
 *   "1198"        -> "(11) 98"
 *   "11987654321" -> "(11) 98765-4321"
 *   "1133334444"  -> "(11) 3333-4444"
 */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  // 8-digit landline splits 4-4; 9-digit mobile splits 5-4.
  const headLength = rest.length > 8 ? 5 : 4;

  if (rest.length <= headLength) return `(${ddd}) ${rest}`;

  return `(${ddd}) ${rest.slice(0, headLength)}-${rest.slice(headLength)}`;
}

/**
 * Formats a stored number for display. Returns the input untouched when it does
 * not look like a complete BR number, so unexpected server data is shown as-is
 * rather than silently mangled.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";

  const digits = nationalDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return value;

  return maskPhone(digits);
}

/** Last 4 digits, for confirming identity out loud without reading it all. */
export function phoneTail(value: string | null | undefined): string {
  return nationalDigits(value ?? "").slice(-4);
}
