import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../../../apps/fidelidade-api/src/utils/unique-violation";

/**
 * The cause-walking below is not defensive coding: drizzle really does wrap the
 * driver error in a `DrizzleQueryError` whose `cause` holds the pg error, so a
 * check that only inspects the top-level object silently never matches and every
 * duplicate name becomes a 500.
 */
function pgError(code: string, constraint?: string) {
  return Object.assign(new Error("duplicate key value"), { code, constraint });
}

function drizzleWrapped(inner: unknown) {
  return Object.assign(new Error("Failed query"), { cause: inner });
}

describe("isUniqueViolation", () => {
  it("recognises a bare pg unique violation", () => {
    expect(isUniqueViolation(pgError("23505"))).toBe(true);
  });

  it("recognises one wrapped by drizzle", () => {
    expect(isUniqueViolation(drizzleWrapped(pgError("23505")))).toBe(true);
  });

  it("matches a named constraint through the wrapper", () => {
    const error = drizzleWrapped(
      pgError("23505", "programs_store_name_active_unique"),
    );

    expect(isUniqueViolation(error, "programs_store_name_active_unique")).toBe(
      true,
    );
    expect(isUniqueViolation(error, "customers_store_phone_unique")).toBe(
      false,
    );
  });

  it("ignores other Postgres errors", () => {
    // A foreign-key or not-null violation is a bug, and must not be translated
    // into a friendly 409 that hides it.
    expect(isUniqueViolation(drizzleWrapped(pgError("23503")))).toBe(false);
    expect(isUniqueViolation(drizzleWrapped(pgError("23502")))).toBe(false);
  });

  it("ignores non-database values", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });

  it("does not loop forever on a self-referencing cause", () => {
    const looped: { cause?: unknown } = {};
    looped.cause = looped;

    expect(isUniqueViolation(looped)).toBe(false);
  });
});
