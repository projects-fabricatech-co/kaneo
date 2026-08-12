import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, onlyDigits, phoneTail } from "./phone";

describe("onlyDigits", () => {
  it("keeps digits and caps at 11 for the typing mask", () => {
    expect(onlyDigits("(11) 98765-4321")).toBe("11987654321");
    expect(onlyDigits("abc")).toBe("");
    expect(onlyDigits("119876543219999")).toHaveLength(11);
  });
});

describe("maskPhone", () => {
  it("masks progressively so the caret never jumps ahead", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("1")).toBe("(1");
    expect(maskPhone("11")).toBe("(11");
    expect(maskPhone("1198")).toBe("(11) 98");
    expect(maskPhone("11987")).toBe("(11) 987");
  });

  it("splits a 9-digit mobile as 5-4", () => {
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("splits an 8-digit landline as 4-4", () => {
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("ignores non-digits in the input", () => {
    expect(maskPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });
});

describe("formatPhone", () => {
  it("formats the E.164 value the API actually stores", () => {
    // Regression: the country code has to come off before the 11-digit cap,
    // otherwise this renders "(55) 11987-6543".
    expect(formatPhone("+5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("5511987654321")).toBe("(11) 98765-4321");
  });

  it("formats a stored landline in E.164", () => {
    expect(formatPhone("+551133334444")).toBe("(11) 3333-4444");
  });

  it("still formats plain national digits", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });

  it("passes through anything too short or too long to be a BR number", () => {
    // Better to show unexpected server data verbatim than to mangle it.
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone("1198765")).toBe("1198765");
    expect(formatPhone("123456789012345")).toBe("123456789012345");
  });

  it("cannot detect a foreign number that happens to be 11 digits", () => {
    // "+1 323 555 0100" is indistinguishable from a BR mobile in DDD 13
    // (Santos), so it formats as one. Documented rather than guarded: the API
    // rejects non-BR numbers, so one can never reach this display helper.
    expect(formatPhone("+13235550100")).toBe("(13) 23555-0100");
  });
});

describe("phoneTail", () => {
  it("returns the real last four digits of a stored E.164 number", () => {
    // Regression: used to return "6543" because of the same truncation.
    expect(phoneTail("+5511987654321")).toBe("4321");
    expect(phoneTail("+551133334444")).toBe("4444");
  });

  it("works on national digits too", () => {
    expect(phoneTail("11987654321")).toBe("4321");
    expect(phoneTail("(11) 98765-4321")).toBe("4321");
  });

  it("is empty for empty input", () => {
    expect(phoneTail(null)).toBe("");
    expect(phoneTail(undefined)).toBe("");
    expect(phoneTail("")).toBe("");
  });
});
