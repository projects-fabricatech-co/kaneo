import { HTTPException } from "hono/http-exception";

/**
 * Every failure of the "Validar código" screen, as a JSON body.
 *
 * Built with the `res` option rather than `message` — exactly like
 * `plan-limit-error.ts` and `cooldown-error.ts`, and for the same reason: Hono
 * renders `message` as PLAIN TEXT, and this screen has to react differently to
 * each case (a typo gets the field cleared and refocused; an already-used code
 * gets a red panel with the date it was used; an expired one gets an offer to
 * talk to the owner). A single opaque 400 would make all three look like the
 * cashier's fault.
 *
 * The status codes are the distinguishing part and the `error` string is the
 * stable contract; the pt-BR `message` is what the lojista reads out loud.
 */
function codeError(
  status: 400 | 404 | 409 | 410 | 501,
  body: Record<string, unknown>,
): HTTPException {
  return new HTTPException(status, {
    res: Response.json(body, { status }),
  });
}

/** 400 — not a code at all: wrong prefix, or too short to be one. */
export function invalidCodeError(): HTTPException {
  return codeError(400, {
    error: "invalid_code",
    message: "Código inválido. Confira os caracteres e tente de novo.",
  });
}

/**
 * 404 — no such code IN THIS STORE. A code belonging to another shop is
 * indistinguishable from a typo, which is the whole point: the endpoint must not
 * confirm that somebody else's code exists.
 */
export function codeNotFoundError(): HTTPException {
  return codeError(404, {
    error: "code_not_found",
    message: "Código não encontrado",
  });
}

/**
 * 409 — the code was real and is now spent. The date is in the message because
 * this is the answer to "mas eu não usei!", and it is in the body as an ISO
 * instant because the client formats its own UI.
 */
export function codeAlreadyRedeemedError(
  redeemedAt: Date | null,
  timezone: string,
): HTTPException {
  const when = redeemedAt ? formatInstant(redeemedAt, timezone) : null;

  return codeError(409, {
    error: "code_already_redeemed",
    redeemedAt: redeemedAt ? redeemedAt.toISOString() : null,
    message: when
      ? `Código já utilizado em ${when}`
      : "Este código já foi utilizado",
  });
}

/** 410 Gone — it existed, it was never used, and the window has closed. */
export function codeExpiredError(
  expiresAt: Date | null,
  timezone: string,
): HTTPException {
  const when = expiresAt ? formatInstant(expiresAt, timezone) : null;

  return codeError(410, {
    error: "code_expired",
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    message: when ? `Código expirado em ${when}` : "Código expirado",
  });
}

/**
 * 409 fallback. Reached only when the conditional UPDATE matched nothing and the
 * diagnostic then found a perfectly redeemable row — i.e. a concurrent
 * redemption committed in between and this reader saw it before its own
 * snapshot caught up. Rare, but "nothing happened" is never an acceptable
 * answer with the customer standing there.
 */
export function codeNotRedeemableError(): HTTPException {
  return codeError(409, {
    error: "code_not_redeemable",
    message: "Não foi possível resgatar este código. Tente de novo.",
  });
}

// ── PHASE 4 EXTENSION POINT ────────────────────────────────────────────────
// Coupon codes (`C` prefix) are a Phase 4 feature. The dispatcher in
// `code/controllers/*` already routes them here rather than falling through to
// a crash or, worse, a "código não encontrado" that would send the lojista
// hunting for a typo in a code that is perfectly valid.
//
// When Phase 4 lands, delete this and route the `coupon` kind to the
// coupon-redemption controllers instead.
// ───────────────────────────────────────────────────────────────────────────
export function couponNotAvailableError(): HTTPException {
  return codeError(501, {
    error: "coupon_not_available",
    message: "Cupons ainda não estão disponíveis.",
  });
}

/** "09/08/2026 14:32", in the store's own timezone. */
function formatInstant(instant: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(instant);
  } catch {
    // A store row with a junk timezone must not turn a 409 into a 500.
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(instant);
  }
}
