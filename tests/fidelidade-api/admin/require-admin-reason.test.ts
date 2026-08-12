import { describe, expect, it } from "vitest";
import {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  normalizeAdminReason,
} from "../../../apps/fidelidade-api/src/admin/require-admin-reason";

/**
 * The rule that turns "an admin looked at a customer" into "an admin looked at a
 * customer, and said why".
 *
 * It has no route calling it yet — phase A's endpoints are all aggregates, and
 * an aggregate is about nobody in particular. It ships now because phase B's
 * first screen reads a person's row, and a guard written alongside the screen
 * that needs it is a guard written under pressure to be lenient.
 */
describe("normalizeAdminReason", () => {
  it("accepts a real explanation and trims it", () => {
    expect(normalizeAdminReason("  Lojista abriu chamado #482  ")).toBe(
      "Lojista abriu chamado #482",
    );
  });

  it("rejects a missing header", () => {
    expect(normalizeAdminReason(undefined)).toBeNull();
  });

  it("rejects whitespace, which is what an empty header sends", () => {
    expect(normalizeAdminReason("   ")).toBeNull();
  });

  /**
   * A one-character reason is the shape a caller sends to satisfy the guard
   * without answering it. The floor is low on purpose — the point is to make the
   * empty gesture visibly empty, not to grade prose.
   */
  it("rejects a reason too short to mean anything", () => {
    expect(normalizeAdminReason("x")).toBeNull();
    expect(normalizeAdminReason("a".repeat(MIN_REASON_LENGTH - 1))).toBeNull();
    expect(normalizeAdminReason("a".repeat(MIN_REASON_LENGTH))).not.toBeNull();
  });

  /**
   * Truncated, not rejected. The reason is already recorded by the time the
   * length matters, and refusing a long one would lose the access record over
   * somebody being thorough.
   */
  it("caps a long reason instead of refusing it", () => {
    const long = "b".repeat(MAX_REASON_LENGTH + 50);

    expect(normalizeAdminReason(long)).toHaveLength(MAX_REASON_LENGTH);
  });

  it("trims before measuring, so padding cannot buy the minimum", () => {
    expect(
      normalizeAdminReason(`  ${"a".repeat(MIN_REASON_LENGTH - 1)}  `),
    ).toBeNull();
  });
});
