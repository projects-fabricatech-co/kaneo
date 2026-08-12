/**
 * WCAG contrast, applied to the one colour in this product we do not control:
 * the lojista's own.
 *
 * The design system lets a shop bring its brand colour and says that colour has
 * to pass a contrast check, adjusting or falling back when it does not. Without
 * this, a bakery that picks pale yellow ships a card whose text is invisible —
 * and the person who suffers is their customer, standing in the shop, holding a
 * card they cannot read.
 *
 * The card is a light surface with dark text or the reverse, never a gradient,
 * so picking the readable foreground is enough; there is no need to distort the
 * colour the shop chose. The fallback exists for the case where the stored value
 * is not a colour at all.
 */

/** Vale Desconto's own, used when a stored value cannot be parsed. */
export const FALLBACK_BRAND_COLOR = "#D93825";

const INK = "#211917";
const PAPER = "#FFFFFF";

/** WCAG 2.2 AA for normal text. Large text would be 3:1, but the card mixes both. */
const MIN_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

/** Accepts `#abc` and `#aabbcc`; returns 0-255 channels. */
function channels(hex: string): [number, number, number] {
  const raw = hex.trim().slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance: sRGB channels linearized, then weighted. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Ink or paper, whichever the shop's colour can actually be read against. */
export function readableForeground(background: string): string {
  if (!isHexColor(background)) {
    return PAPER;
  }

  return contrastRatio(background, INK) >= contrastRatio(background, PAPER)
    ? INK
    : PAPER;
}

export type MerchantTheme = {
  background: string;
  foreground: string;
};

/**
 * The shop's colour, made safe to render.
 *
 * A `preferred` foreground is honoured only if it actually passes — the lojista
 * picking white on pale yellow is a mistake we correct rather than publish. An
 * unparseable background falls back to Vale Desconto's own, which is the rule
 * the design system states.
 */
export function merchantTheme(
  background: string | null | undefined,
  preferred?: string | null,
): MerchantTheme {
  const safeBackground = isHexColor(background)
    ? background.trim()
    : FALLBACK_BRAND_COLOR;

  if (
    isHexColor(preferred) &&
    contrastRatio(safeBackground, preferred.trim()) >= MIN_CONTRAST
  ) {
    return { background: safeBackground, foreground: preferred.trim() };
  }

  return {
    background: safeBackground,
    foreground: readableForeground(safeBackground),
  };
}
