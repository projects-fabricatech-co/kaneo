import { describe, expect, it } from "vitest";
import { evaluateCooldown } from "../../../apps/fidelidade-api/src/stamp/cooldown";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

function secondsAgo(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

describe("evaluateCooldown", () => {
  it("never blocks the first stamp on a card", () => {
    expect(evaluateCooldown(null, 60, NOW)).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });

  it("is disabled entirely at 0 minutes", () => {
    // A shop that stamps per item, not per visit.
    expect(evaluateCooldown(secondsAgo(1), 0, NOW).blocked).toBe(false);
    expect(evaluateCooldown(NOW, 0, NOW).blocked).toBe(false);
  });

  it("blocks a second stamp inside the window", () => {
    const verdict = evaluateCooldown(minutesAgo(10), 60, NOW);

    expect(verdict.blocked).toBe(true);
    expect(verdict.retryAfterSeconds).toBe(50 * 60);
  });

  it("allows a stamp at EXACTLY the cooldown boundary", () => {
    // The boundary is inclusive on purpose: a cashier who waited the advertised
    // hour must not be told to wait longer.
    expect(evaluateCooldown(minutesAgo(60), 60, NOW).blocked).toBe(false);
    expect(evaluateCooldown(secondsAgo(60), 1, NOW).blocked).toBe(false);
  });

  it("blocks one millisecond before the boundary", () => {
    const lastStampAt = new Date(NOW.getTime() - (60 * 60_000 - 1));
    const verdict = evaluateCooldown(lastStampAt, 60, NOW);

    expect(verdict.blocked).toBe(true);
    // Rounded UP and floored at 1: a client that trusted a 0 would retry
    // straight into another 429.
    expect(verdict.retryAfterSeconds).toBe(1);
  });

  it("rounds the remaining wait up to whole seconds", () => {
    // 90.4s remaining of a 120s window.
    const lastStampAt = new Date(NOW.getTime() - 29_600);
    expect(evaluateCooldown(lastStampAt, 2, NOW).retryAfterSeconds).toBe(91);
  });

  it("reports 0 seconds whenever it is not blocking", () => {
    expect(evaluateCooldown(minutesAgo(120), 60, NOW).retryAfterSeconds).toBe(
      0,
    );
    expect(evaluateCooldown(null, 60, NOW).retryAfterSeconds).toBe(0);
  });

  it("clamps a last stamp dated in the future to the full cooldown", () => {
    // Clock skew between the app server and the database would otherwise produce
    // a negative elapsed time and an absurd wait.
    const future = new Date(NOW.getTime() + 5 * 60_000);
    const verdict = evaluateCooldown(future, 10, NOW);

    expect(verdict.blocked).toBe(true);
    expect(verdict.retryAfterSeconds).toBe(10 * 60);
  });

  it("handles the maximum cooldown of 1440 minutes", () => {
    const verdict = evaluateCooldown(minutesAgo(1), 1440, NOW);

    expect(verdict.blocked).toBe(true);
    expect(verdict.retryAfterSeconds).toBe(1439 * 60);
  });
});
