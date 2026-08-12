import { HTTPException } from "hono/http-exception";
import type { cardTable } from "../database/schema";

type CardRow = typeof cardTable.$inferSelect;

/**
 * 429, built with the `res` option rather than `message` — exactly like
 * `plan-limit-error.ts` and for the same reason: Hono renders `message` as PLAIN
 * TEXT, and the stamp screen needs structured data. It shows a countdown from
 * `retryAfterSeconds` and keeps rendering the card, so the cashier can see
 * "8/10, aguarde 42s" instead of a bare error.
 */
export function stampCooldownError(
  retryAfterSeconds: number,
  card: CardRow | null,
): HTTPException {
  return new HTTPException(429, {
    res: Response.json(
      {
        error: "stamp_cooldown",
        retryAfterSeconds,
        card,
        message: "Aguarde antes de carimbar novamente",
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    ),
  });
}
