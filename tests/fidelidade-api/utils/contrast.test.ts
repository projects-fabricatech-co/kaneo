import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  FALLBACK_BRAND_COLOR,
  isHexColor,
  merchantTheme,
  readableForeground,
  relativeLuminance,
} from "../../../apps/fidelidade-api/src/utils/contrast";

describe("contrast", () => {
  describe("relativeLuminance", () => {
    it("puts black at 0 and white at 1", () => {
      expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
      expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    });

    it("reads a three-digit hex the same as its expanded form", () => {
      expect(relativeLuminance("#abc")).toBeCloseTo(
        relativeLuminance("#aabbcc"),
        10,
      );
    });
  });

  describe("contrastRatio", () => {
    it("gives 21:1 for black on white", () => {
      expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    });

    it("gives 1:1 for a colour against itself", () => {
      expect(contrastRatio("#F24B35", "#F24B35")).toBeCloseTo(1, 5);
    });

    it("does not care which colour is named first", () => {
      expect(contrastRatio("#211917", "#FFFFFF")).toBeCloseTo(
        contrastRatio("#FFFFFF", "#211917"),
        10,
      );
    });
  });

  describe("readableForeground", () => {
    it("puts ink on a pale surface", () => {
      // The failure this prevents: a bakery picks pale yellow and ships a card
      // whose white text is invisible to the customer holding it.
      expect(readableForeground("#FFF2C2")).toBe("#211917");
    });

    it("puts paper on a dark surface", () => {
      expect(readableForeground("#211917")).toBe("#FFFFFF");
    });

    it("clears AA on the brand coral", () => {
      const foreground = readableForeground("#D93825");
      expect(contrastRatio("#D93825", foreground)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("merchantTheme", () => {
    it("keeps a foreground the lojista chose when it actually passes", () => {
      const theme = merchantTheme("#211917", "#FFFFFF");
      expect(theme).toEqual({ background: "#211917", foreground: "#FFFFFF" });
    });

    it("overrides a foreground the lojista chose that cannot be read", () => {
      const theme = merchantTheme("#FFF2C2", "#FFFFFF");
      expect(theme.foreground).toBe("#211917");
      // Their background is untouched — we correct the unreadable half, we do
      // not repaint their brand.
      expect(theme.background).toBe("#FFF2C2");
    });

    it("falls back to Vale Desconto when the stored value is not a colour", () => {
      expect(merchantTheme("azul", "#FFFFFF").background).toBe(
        FALLBACK_BRAND_COLOR,
      );
      expect(merchantTheme(null).background).toBe(FALLBACK_BRAND_COLOR);
      expect(merchantTheme("").background).toBe(FALLBACK_BRAND_COLOR);
    });

    it("always returns a pair that clears AA", () => {
      const surfaces = [
        "#FFFFFF",
        "#000000",
        "#F24B35",
        "#FFF2C2",
        "#16865B",
        "#7c716a",
        "#abc",
      ];

      for (const surface of surfaces) {
        const theme = merchantTheme(surface, "#FFFFFF");
        expect(
          contrastRatio(theme.background, theme.foreground),
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("trims a stored value that carries whitespace", () => {
      expect(merchantTheme("  #16865B  ").background).toBe("#16865B");
    });
  });

  describe("isHexColor", () => {
    it("accepts both hex lengths, in either case", () => {
      expect(isHexColor("#abc")).toBe(true);
      expect(isHexColor("#AABBCC")).toBe(true);
    });

    it("rejects anything else", () => {
      for (const value of ["abc", "#ab", "#abcd", "rgb(1,2,3)", "", null]) {
        expect(isHexColor(value)).toBe(false);
      }
    });
  });
});
