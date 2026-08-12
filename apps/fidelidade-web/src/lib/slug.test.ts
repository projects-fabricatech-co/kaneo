import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates a store name", () => {
    expect(slugify("Padaria da Esquina")).toBe("padaria-da-esquina");
  });

  it("strips accents, which most Brazilian store names have", () => {
    expect(slugify("Açaí do João")).toBe("acai-do-joao");
    expect(slugify("Café Ônix")).toBe("cafe-onix");
    expect(slugify("Pão & Cia")).toBe("pao-cia");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("Bar   do  Zé!!!")).toBe("bar-do-ze");
    expect(slugify("A---B")).toBe("a-b");
  });

  it("does not start or end with a hyphen", () => {
    expect(slugify("  Padaria  ")).toBe("padaria");
    expect(slugify("!!!Loja!!!")).toBe("loja");
  });

  it("keeps digits", () => {
    expect(slugify("Loja 24 Horas")).toBe("loja-24-horas");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const result = slugify("a".repeat(60));
    expect(result.length).toBeLessThanOrEqual(48);
    expect(result.endsWith("-")).toBe(false);
  });

  it("returns empty for input with nothing slugifiable", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("produces output that satisfies the onboarding slug pattern", () => {
    const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const name of [
      "Padaria da Esquina",
      "Açaí do João",
      "Loja 24 Horas",
      "Bar   do  Zé!!!",
    ]) {
      expect(slugify(name)).toMatch(pattern);
    }
  });
});
