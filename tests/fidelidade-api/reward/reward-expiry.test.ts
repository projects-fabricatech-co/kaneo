import { describe, expect, it } from "vitest";
import { rewardExpiresAt } from "../../../apps/fidelidade-api/src/reward/reward-expiry";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-09T12:00:00.000Z");

describe("rewardExpiresAt", () => {
  it("adds the validity window to the moment the card was completed", () => {
    expect(rewardExpiresAt(30, NOW)?.toISOString()).toBe(
      new Date(NOW.getTime() + 30 * DAY_MS).toISOString(),
    );
  });

  it("handles a one-day window", () => {
    expect(rewardExpiresAt(1, NOW)?.toISOString()).toBe(
      "2026-08-10T12:00:00.000Z",
    );
  });

  it("means 'never expires' when there is no validity", () => {
    // NULL rather than a far-future date, so the redemption predicate
    // `expires_at IS NULL OR expires_at > now()` needs no special case.
    expect(rewardExpiresAt(0, NOW)).toBeNull();
    expect(rewardExpiresAt(null, NOW)).toBeNull();
  });

  it("refuses to date a reward in the past", () => {
    // A negative validity can only come from a bad seed or a bad repair, and
    // "already expired at birth" would be the worst possible reading of it.
    expect(rewardExpiresAt(-5, NOW)).toBeNull();
  });

  it("does not mutate the instant it was given", () => {
    const now = new Date(NOW);
    rewardExpiresAt(30, now);
    expect(now.toISOString()).toBe(NOW.toISOString());
  });
});
