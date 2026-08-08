/**
 * QR generation, client-side only.
 *
 * `qrcode` is imported dynamically so it never lands in the initial bundle —
 * only two screens need it (the customer's identification QR and the coupon
 * share panel), and both are reached after a navigation.
 */

export type QrOptions = {
  /** Rendered edge length in px. */
  size?: number;
  /** Quiet-zone width in modules. 2 is the practical minimum that still scans. */
  margin?: number;
  dark?: string;
  light?: string;
};

/**
 * Returns an SVG string. SVG rather than a data-URI PNG so the code stays sharp
 * when a customer zooms in on a phone, and so it inherits no raster scaling.
 */
export async function generateQrSvg(
  value: string,
  options: QrOptions = {},
): Promise<string> {
  // Aliased: destructuring as `toString` would shadow the global.
  const { toString: renderQr } = await import("qrcode");

  return renderQr(value, {
    type: "svg",
    width: options.size ?? 240,
    margin: options.margin ?? 2,
    // Medium recovery: enough to survive a scuffed phone screen without
    // inflating the module count for what is a short URL.
    errorCorrectionLevel: "M",
    color: {
      dark: options.dark ?? "#000000",
      light: options.light ?? "#FFFFFF",
    },
  });
}

/** The public URL a customer opens for their card. */
export function publicCardUrl(token: string): string {
  const base =
    import.meta.env.VITE_FIDELIDADE_CLIENT_URL ?? window.location.origin;
  return `${base.replace(/\/+$/, "")}/c/${token}`;
}

/** The public URL a customer opens to claim a coupon. */
export function publicCouponUrl(token: string): string {
  const base =
    import.meta.env.VITE_FIDELIDADE_CLIENT_URL ?? window.location.origin;
  return `${base.replace(/\/+$/, "")}/cupom/${token}`;
}
