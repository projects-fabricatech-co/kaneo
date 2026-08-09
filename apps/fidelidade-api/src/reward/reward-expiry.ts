const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * When a reward stops being redeemable, computed at the moment the card is
 * completed rather than read from the program later: raising or lowering
 * `rewardValidityDays` tomorrow must not move the deadline on a code the
 * customer already holds.
 *
 * A validity of 0 (or anything non-positive, which only a seed or a repair can
 * produce — the API schema floors it at 1) means "never expires", and is
 * represented by a NULL `expires_at` so the redemption predicate
 * `expires_at IS NULL OR expires_at > now()` needs no special case.
 */
export function rewardExpiresAt(
  validityDays: number | null,
  now: Date,
): Date | null {
  if (validityDays === null || validityDays <= 0) {
    return null;
  }

  return new Date(now.getTime() + validityDays * MILLISECONDS_PER_DAY);
}
