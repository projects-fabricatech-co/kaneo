/**
 * Postgres `unique_violation`. Used where the conflicting index is PARTIAL and
 * `onConflictDoNothing` cannot address it cleanly (`programs_store_name_active_unique`
 * is `(store_id, name) WHERE status = 'active'`), and on UPDATE statements,
 * which have no `ON CONFLICT` clause at all.
 *
 * Without this the raw driver error escapes as a 500 with an English Postgres
 * message, which is neither actionable for the shop owner nor safe to surface.
 */
const UNIQUE_VIOLATION = "23505";

type PostgresError = {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
};

/** Drizzle wraps driver errors in a `DrizzleQueryError`, so walk `cause`. */
const MAX_CAUSE_DEPTH = 5;

export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  let candidate = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      return false;
    }

    const { code, constraint: violated, cause } = candidate as PostgresError;

    if (code === UNIQUE_VIOLATION) {
      return constraint === undefined || violated === constraint;
    }

    candidate = cause;
  }

  return false;
}
