import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeClaimAttempt,
  resetClaimRateLimit,
} from "../../../apps/fidelidade-api/src/public/claim-rate-limit";

const CAMPAIGN = "token-campanha";
const OTHER_CAMPAIGN = "token-outra";

/** Consumes `times` attempts and reports how many were refused. */
function drain(
  times: number,
  {
    ip,
    token = CAMPAIGN,
    phone,
  }: { ip: string | null; token?: string; phone: string },
): number {
  let refused = 0;

  for (let i = 0; i < times; i += 1) {
    try {
      consumeClaimAttempt(ip, token, phone);
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(429);
      refused += 1;
    }
  }

  return refused;
}

describe("consumeClaimAttempt", () => {
  beforeEach(() => {
    resetClaimRateLimit();
  });

  it("lets an ordinary person claim, and a fat-fingered retry too", () => {
    expect(drain(4, { ip: "203.0.113.7", phone: "11987654321" })).toBe(0);
  });

  it("stops one phone hammering one campaign", () => {
    // The thing worth bounding: a real person does this once, a script does it
    // thousands of times, and the attacker cannot forge it without changing who
    // they claim to be.
    expect(drain(9, { ip: "203.0.113.7", phone: "11987654321" })).toBe(4);
  });

  it("does NOT punish a stranger for somebody else's flood, with no IP header", () => {
    // The regression this locks. Keyed on IP alone with an "unknown" fallback,
    // seventeen header-less requests locked the campaign for TEN MINUTES for
    // every other header-less caller.
    drain(30, { ip: null, phone: "11900000001" });

    expect(drain(1, { ip: null, phone: "11955554444" })).toBe(0);
  });

  it("does not punish a neighbour behind the same CGNAT for one flooder", () => {
    const shared = "100.64.12.9";
    drain(30, { ip: shared, phone: "11900000001" });

    expect(drain(1, { ip: shared, phone: "11955554444" })).toBe(0);
  });

  it("still blunts a script rotating phone numbers from one address", () => {
    let refused = 0;

    for (let i = 0; i < 80; i += 1) {
      try {
        consumeClaimAttempt("203.0.113.9", CAMPAIGN, `1190000${1000 + i}`);
      } catch {
        refused += 1;
      }
    }

    expect(refused).toBeGreaterThan(0);
  });

  it("counts each campaign separately", () => {
    drain(9, { ip: "203.0.113.7", phone: "11987654321" });

    expect(
      drain(1, {
        ip: "203.0.113.7",
        token: OTHER_CAMPAIGN,
        phone: "11987654321",
      }),
    ).toBe(0);
  });

  it("counts an unparseable phone rather than skipping the limiter", () => {
    // A limiter that only counts well-formed input is a limiter an attacker
    // skips by sending garbage.
    expect(drain(9, { ip: null, phone: "não é telefone" })).toBe(4);
  });

  it("does not throw on an empty phone, which validation refuses anyway", () => {
    expect(drain(3, { ip: null, phone: "   " })).toBe(0);
  });
});
