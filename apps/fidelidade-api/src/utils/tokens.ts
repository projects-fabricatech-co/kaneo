import { randomBytes } from "node:crypto";

/**
 * Public tokens are the ONLY thing standing between an URL and a customer's
 * card, so they are 128 bits of CSPRNG output — not CUID2, which is not
 * documented as security-grade.
 */
export function generatePublicToken(): string {
  return randomBytes(16).toString("base64url");
}
