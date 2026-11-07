import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

export const ADMIN_REASON_HEADER = "X-Admin-Reason";

export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 280;

/**
 * Pure, so the rule can be tested without a request.
 *
 * `null` means the header does not carry a usable reason. The caller turns that
 * into the status; splitting it this way keeps the length bounds in one place
 * and out of both the middleware and its tests.
 */
export function normalizeAdminReason(raw: string | undefined): string | null {
  const reason = raw?.trim();

  if (!reason || reason.length < MIN_REASON_LENGTH) {
    return null;
  }

  return reason.slice(0, MAX_REASON_LENGTH);
}

/**
 * Demands a declared reason before an administrator may read a person's data.
 *
 * A header rather than a query parameter on purpose: a reason can name the
 * person it is about, and query strings end up in access logs, browser history
 * and `Referer` headers. It is uniform across GET and POST, which a body cannot
 * be.
 *
 * 422 matches how the rest of this API answers a malformed request; 400 would
 * blur into the "could not identify the store" case, and 403 would suggest the
 * caller lacks permission when what they lack is an explanation.
 *
 * Note the ORDER this must be mounted in: after `requirePlatformAdmin`, so a
 * non-admin probing for the header's existence still gets a plain 404.
 */
export function requireAdminReason() {
  return async (c: Context, next: Next) => {
    const reason = normalizeAdminReason(c.req.header(ADMIN_REASON_HEADER));

    if (!reason) {
      throw new HTTPException(422, {
        message: `Informe o motivo do acesso no cabeçalho ${ADMIN_REASON_HEADER}.`,
      });
    }

    c.set("adminReason", reason);

    return next();
  };
}
