import { afterEach, vi } from "vitest";

// FIRST statement, before anything can import the app. `dotenv-mono` would load
// the repo's real .env and could point these tests at the development database,
// which resetTestDatabase() TRUNCATEs.
vi.mock("dotenv-mono", () => ({
  config: () => {},
}));

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/fidelidade_test";

/** Appends `_test` to the database name unless it is already suffixed. */
function deriveTestDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const name = url.pathname.replace(/^\//, "");

    if (!name) {
      return DEFAULT_TEST_DATABASE_URL;
    }

    if (name.endsWith("_test")) {
      return url.toString();
    }

    url.pathname = `/${name}_test`;
    return url.toString();
  } catch {
    return DEFAULT_TEST_DATABASE_URL;
  }
}

/**
 * The only thing between a mis-set env var and a truncated development database.
 * Deliberately a hard failure, not a warning.
 */
function assertTestDatabaseUrl(rawUrl: string): string {
  let name: string;

  try {
    name = new URL(rawUrl).pathname.replace(/^\//, "");
  } catch {
    throw new Error(`FIDELIDADE_DATABASE_URL is not a valid URL: ${rawUrl}`);
  }

  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must end in "_test".`,
    );
  }

  return rawUrl;
}

const resolvedUrl = deriveTestDatabaseUrl(
  process.env.FIDELIDADE_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL,
);

process.env.FIDELIDADE_DATABASE_URL = assertTestDatabaseUrl(resolvedUrl);

process.env.NODE_ENV = "test";
process.env.FIDELIDADE_AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.FIDELIDADE_API_URL = "http://localhost:1338";
process.env.FIDELIDADE_CLIENT_URL = "http://localhost:5174";
process.env.FIDELIDADE_CORS_ORIGINS = "";
process.env.FIDELIDADE_GOOGLE_CLIENT_ID = "";
process.env.FIDELIDADE_GOOGLE_CLIENT_SECRET = "";

// Plans must be resolved from the database, never from the dev override.
delete process.env.FIDELIDADE_DEV_FORCE_PLAN;

// Stripe stays "configured" with fake values so the billing code paths are
// exercised; the client module itself is aliased to a mock by the vitest config.
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
process.env.STRIPE_PRICE_ESSENCIAL_MONTHLY = "price_essencial_monthly_mock";
process.env.STRIPE_PRICE_ESSENCIAL_ANNUAL = "price_essencial_annual_mock";
process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_mock";
process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_annual_mock";

afterEach(() => {
  vi.restoreAllMocks();
});
