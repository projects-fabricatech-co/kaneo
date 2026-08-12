export type CooldownVerdict = {
  blocked: boolean;
  /** Whole seconds the caller must wait. 0 when not blocked. */
  retryAfterSeconds: number;
};

const NOT_BLOCKED: CooldownVerdict = { blocked: false, retryAfterSeconds: 0 };

/**
 * PURE, so the boundary arithmetic is unit-testable without a database.
 *
 * The cooldown exists to stop a customer (or a cashier) filling a card in one
 * visit. Two boundary decisions worth stating:
 *
 *  - the comparison is strictly `<`, so a stamp at exactly `cooldownMinutes`
 *    after the last one is ALLOWED. A cashier who waited the advertised hour
 *    must not be told to wait longer.
 *  - `retryAfterSeconds` is rounded UP and floored at 1, so it is never 0 while
 *    still blocked — a client that trusts a 0 would retry into another 429.
 *
 * `cooldownMinutes` of 0 disables the cooldown entirely, which is what a shop
 * that stamps per item rather than per visit wants.
 */
export function evaluateCooldown(
  lastStampAt: Date | null,
  cooldownMinutes: number,
  now: Date,
): CooldownVerdict {
  if (!lastStampAt || cooldownMinutes <= 0) {
    return NOT_BLOCKED;
  }

  const cooldownMs = cooldownMinutes * 60_000;
  const elapsedMs = now.getTime() - lastStampAt.getTime();

  // A clock skew that puts the last stamp in the future would otherwise produce
  // a negative elapsed time and an absurd wait; clamp it to the full cooldown.
  const remainingMs = cooldownMs - Math.max(elapsedMs, 0);

  if (remainingMs <= 0) {
    return NOT_BLOCKED;
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}
