/**
 * The Kaneo fetcher idiom is `throw new Error(await response.text())`, which is
 * fine for plain-text errors but dumps raw JSON into a toast when the API
 * answers with a structured body.
 *
 * The one structured body Phase 1 has to handle is the plan limit: HTTP 402 with
 * `{ error: "plan_limit_exceeded", limit, max, used, plan, message }`. We keep
 * that information on the thrown error so a caller can show `message` and, from
 * Phase 6 on, open the upgrade sheet instead of a toast.
 */

export type PlanLimitPayload = {
  error: "plan_limit_exceeded";
  /** Which limit was hit, e.g. "stores". */
  limit: string;
  max: number;
  used: number;
  plan: string;
  message: string;
};

export class PlanLimitError extends Error {
  readonly limit: string;
  readonly max: number;
  readonly used: number;
  readonly plan: string;

  constructor(payload: PlanLimitPayload) {
    super(payload.message);
    this.name = "PlanLimitError";
    this.limit = payload.limit;
    this.max = payload.max;
    this.used = payload.used;
    this.plan = payload.plan;
  }
}

export function isPlanLimitError(error: unknown): error is PlanLimitError {
  return error instanceof PlanLimitError;
}

function safeJsonParse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isPlanLimitPayload(value: unknown): value is PlanLimitPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.error === "plan_limit_exceeded" &&
    typeof candidate.message === "string"
  );
}

function messageOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.error === "string") return candidate.error;
  return undefined;
}

/**
 * Builds the error to throw for a non-ok response. Returns rather than throws so
 * fetchers can write `throw await apiError(response)` — a real `throw`
 * statement, which keeps TanStack/Hono response narrowing intact.
 */
export async function apiError(response: Response): Promise<Error> {
  const body = await response.text();
  const parsed = safeJsonParse(body);

  if (response.status === 402 && isPlanLimitPayload(parsed)) {
    return new PlanLimitError(parsed);
  }

  return new Error(
    messageOf(parsed) || body || response.statusText || "Erro inesperado",
  );
}
