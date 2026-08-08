import type { DatabaseExecutor } from "../database/executor";
import { acquireAdvisoryLock } from "../utils/advisory-lock";
import type { PlanId } from "./limits";
import { type PlanLimitCode, planLimitError } from "./plan-limit-error";

export type AssertWithinLimitOptions = {
  /** Advisory-lock key, e.g. `limit:stores:${ownerUserId}`. */
  lockKey: string;
  /** `null` means unlimited. */
  limit: number | null;
  /** Counts what already exists. Only called once the lock is held. */
  current: () => Promise<number>;
  code: PlanLimitCode;
  plan: PlanId;
};

/**
 * MUST run inside the controller's transaction, never as middleware: a
 * middleware that counts and a handler that inserts are two statements with a
 * gap between them, so two concurrent requests at 49/50 would both see 49 and
 * both insert. The advisory lock serialises the count-then-insert pair and is
 * released when the transaction ends.
 */
export async function assertWithinLimit(
  tx: DatabaseExecutor,
  { lockKey, limit, current, code, plan }: AssertWithinLimitOptions,
): Promise<void> {
  if (limit === null) {
    return;
  }

  await acquireAdvisoryLock(tx, lockKey);

  const used = await current();

  if (used >= limit) {
    throw planLimitError(code, limit, used, plan);
  }
}
