import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import {
  formatBrPhone,
  isValidBrPhone,
  maskBrPhone,
  normalizeBrPhone,
} from "../../../apps/fidelidade-api/src/utils/phone";

describe("normalizeBrPhone", () => {
  it("strips formatting characters", () => {
    expect(normalizeBrPhone("(11) 98765-4321")).toBe("+5511987654321");
    expect(normalizeBrPhone("11 98765 4321")).toBe("+5511987654321");
    expect(normalizeBrPhone("+55 11 98765-4321")).toBe("+5511987654321");
    expect(normalizeBrPhone("11.98765.4321")).toBe("+5511987654321");
  });

  it("drops the +55 country code when present", () => {
    expect(normalizeBrPhone("5511987654321")).toBe("+5511987654321");
    // 12 digits: country code + 10-digit landline
    expect(normalizeBrPhone("551133334444")).toBe("+551133334444");
  });

  it("drops the legacy trunk zero", () => {
    expect(normalizeBrPhone("011987654321")).toBe("+5511987654321");
    expect(normalizeBrPhone("01133334444")).toBe("+551133334444");
  });

  it("applies the 9th-digit rule to old-style mobile numbers", () => {
    // This is the rule that stops one person being stored as two customers.
    expect(normalizeBrPhone("1187654321")).toBe("+5511987654321");
    expect(normalizeBrPhone("11 8765-4321")).toBe("+5511987654321");
    expect(normalizeBrPhone("1197654321")).toBe("+5511997654321");
    expect(normalizeBrPhone("1167654321")).toBe("+5511967654321");
  });

  it("is idempotent: normalizing an already-normalized number is a no-op", () => {
    const once = normalizeBrPhone("1187654321");
    expect(normalizeBrPhone(once)).toBe(once);
  });

  it("leaves landlines alone (first subscriber digit 2-5)", () => {
    expect(normalizeBrPhone("1133334444")).toBe("+551133334444");
    expect(normalizeBrPhone("1123334444")).toBe("+551123334444");
    expect(normalizeBrPhone("1145556666")).toBe("+551145556666");
  });

  it("rejects numbers that are too short or too long", () => {
    for (const bad of ["", "1", "119876543", "11987654321987", "123456789"]) {
      expect(() => normalizeBrPhone(bad)).toThrow(HTTPException);
    }
  });

  it("rejects an invalid DDD", () => {
    // Brazilian area codes start at 11; 10 and below are not assignable.
    expect(() => normalizeBrPhone("1098765432")).toThrow(HTTPException);
    expect(() => normalizeBrPhone("0998765432")).toThrow(HTTPException);
  });

  it("rejects input with no digits at all", () => {
    expect(() => normalizeBrPhone("abc-def")).toThrow(HTTPException);
  });

  it("throws a 422 with a pt-BR message", () => {
    try {
      normalizeBrPhone("123");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(422);
      expect((error as HTTPException).message).toBe("Telefone inválido");
    }
  });
});

describe("isValidBrPhone", () => {
  it("mirrors normalizeBrPhone without throwing", () => {
    expect(isValidBrPhone("(11) 98765-4321")).toBe(true);
    expect(isValidBrPhone("1187654321")).toBe(true);
    expect(isValidBrPhone("123")).toBe(false);
    expect(isValidBrPhone("")).toBe(false);
  });
});

describe("maskBrPhone", () => {
  it("hides the middle digits but keeps the last four", () => {
    // The public card shows this so the holder can confirm the card is theirs
    // without the link leaking a full phone number.
    const masked = maskBrPhone("+5511987654321");
    expect(masked).toContain("11");
    expect(masked).toContain("4321");
    expect(masked).not.toContain("98765");
  });
});

describe("formatBrPhone", () => {
  it("formats a mobile number for display", () => {
    expect(formatBrPhone("+5511987654321")).toBe("(11) 98765-4321");
  });

  it("formats a landline for display", () => {
    expect(formatBrPhone("+551133334444")).toBe("(11) 3333-4444");
  });
});
