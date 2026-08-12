import { describe, expect, it } from "vitest";
import {
  CODE_PREFIXES,
  codeKindFromCode,
  generateShortCode,
  SHORT_CODE_ALPHABET,
  SHORT_CODE_BODY_LENGTH,
} from "../../../apps/fidelidade-api/src/utils/short-code";

describe("SHORT_CODE_ALPHABET", () => {
  it("excludes the glyphs a cashier confuses when reading a code aloud", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L", "U"]) {
      expect(SHORT_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("has no duplicate characters", () => {
    expect(new Set(SHORT_CODE_ALPHABET).size).toBe(SHORT_CODE_ALPHABET.length);
  });

  it("is uppercase only", () => {
    expect(SHORT_CODE_ALPHABET).toBe(SHORT_CODE_ALPHABET.toUpperCase());
  });
});

describe("generateShortCode", () => {
  it("prefixes rewards with P and coupons with C", () => {
    expect(generateShortCode("reward").startsWith("P")).toBe(true);
    expect(generateShortCode("coupon").startsWith("C")).toBe(true);
  });

  it("produces prefix + body length characters", () => {
    expect(generateShortCode("reward")).toHaveLength(
      SHORT_CODE_BODY_LENGTH + 1,
    );
  });

  it("only uses characters from the alphabet", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const body = generateShortCode("reward").slice(1);
      for (const char of body) {
        expect(SHORT_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("does not repeat itself over many draws", () => {
    // Not a uniformity proof — just a guard against a broken generator that
    // returns a constant or a low-entropy sequence.
    const codes = new Set(
      Array.from({ length: 500 }, () => generateShortCode("reward")),
    );
    expect(codes.size).toBeGreaterThan(490);
  });

  it("keeps the reward and coupon namespaces disjoint", () => {
    const rewardCodes = Array.from({ length: 50 }, () =>
      generateShortCode("reward"),
    );
    const couponCodes = Array.from({ length: 50 }, () =>
      generateShortCode("coupon"),
    );

    for (const code of rewardCodes) {
      expect(couponCodes).not.toContain(code);
    }
    expect(CODE_PREFIXES.reward).not.toBe(CODE_PREFIXES.coupon);
  });
});

describe("codeKindFromCode", () => {
  it("dispatches on the first character", () => {
    expect(codeKindFromCode("P4KJ9M")).toBe("reward");
    expect(codeKindFromCode("C7XQ2B")).toBe("coupon");
  });

  it("tolerates lowercase and surrounding whitespace, as typed at a counter", () => {
    expect(codeKindFromCode("  p4kj9m ")).toBe("reward");
    expect(codeKindFromCode("c7xq2b")).toBe("coupon");
  });

  it("returns null for an unrecognized prefix", () => {
    expect(codeKindFromCode("X12345")).toBeNull();
    expect(codeKindFromCode("")).toBeNull();
  });

  it("round-trips every generated code", () => {
    expect(codeKindFromCode(generateShortCode("reward"))).toBe("reward");
    expect(codeKindFromCode(generateShortCode("coupon"))).toBe("coupon");
  });
});
