import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  imageUrlSchema,
  MAX_IMAGE_URL_LENGTH,
  nullableImageUrlSchema,
} from "../../../apps/fidelidade-api/src/utils/image-url";

const accepts = (schema: typeof imageUrlSchema, value: unknown) =>
  v.safeParse(schema, value).success;

describe("imageUrlSchema", () => {
  it("accepts an ordinary https logo", () => {
    expect(accepts(imageUrlSchema, "https://cdn.exemplo.com/logo.png")).toBe(
      true,
    );
  });

  it("accepts plain http, because small shops still have it", () => {
    expect(accepts(imageUrlSchema, "http://exemplo.com.br/logo.png")).toBe(
      true,
    );
  });

  it("trims surrounding whitespace instead of rejecting a pasted value", () => {
    const result = v.safeParse(imageUrlSchema, "  https://exemplo.com/l.png  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe("https://exemplo.com/l.png");
    }
  });

  it("refuses javascript:", () => {
    // Inert inside an <img src> today. The point is that this value is rendered
    // on a page belonging to somebody else, and the day it lands anywhere less
    // inert the boundary is the only thing that was ever going to stop it.
    expect(accepts(imageUrlSchema, "javascript:alert(1)")).toBe(false);
  });

  it("refuses a data: payload", () => {
    expect(
      accepts(imageUrlSchema, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="),
    ).toBe(false);
  });

  it("refuses schemes that are not http(s)", () => {
    for (const value of [
      "ftp://exemplo.com/logo.png",
      "file:///etc/passwd",
      "vbscript:msgbox(1)",
    ]) {
      expect(accepts(imageUrlSchema, value)).toBe(false);
    }
  });

  it("refuses something that is not a URL at all", () => {
    for (const value of ["logo.png", "exemplo.com/logo.png", "", "   "]) {
      expect(accepts(imageUrlSchema, value)).toBe(false);
    }
  });

  it("caps the length", () => {
    // A megabyte-long value in a column served on a public page is a denial of
    // service on the customer's data plan.
    const tooLong = `https://exemplo.com/${"a".repeat(MAX_IMAGE_URL_LENGTH)}`;
    expect(accepts(imageUrlSchema, tooLong)).toBe(false);
  });

  it("lets null through the nullable variant, which is how a logo is cleared", () => {
    expect(v.safeParse(nullableImageUrlSchema, null).success).toBe(true);
    expect(
      v.safeParse(nullableImageUrlSchema, "javascript:alert(1)").success,
    ).toBe(false);
  });
});
