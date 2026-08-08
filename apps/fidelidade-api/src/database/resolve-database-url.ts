const LOCAL_FALLBACK_CONNECTION_STRING =
  "postgresql://postgres:postgres@localhost:5432/fidelidade";

type DatabaseConfigSource = "FIDELIDADE_DATABASE_URL" | "LOCAL_FALLBACK";

export type ResolvedDatabaseConfig = {
  connectionString: string;
  source: DatabaseConfigSource;
  host: string;
  port: number;
  database: string;
  username: string;
};

function toResolvedConfig(
  connectionString: string,
  source: DatabaseConfigSource,
): ResolvedDatabaseConfig {
  const url = new URL(connectionString);

  return {
    connectionString,
    source,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    username: decodeURIComponent(url.username),
  };
}

/**
 * Fidelidade owns its own database. Deliberately NOT derived from Kaneo's
 * POSTGRES_* / DATABASE_URL variables — sharing that derivation is how the two
 * products would silently end up migrating the same database.
 */
export function resolveDatabaseConfig(): ResolvedDatabaseConfig {
  const fromEnv = process.env.FIDELIDADE_DATABASE_URL?.trim();

  if (fromEnv) {
    return toResolvedConfig(fromEnv, "FIDELIDADE_DATABASE_URL");
  }

  return toResolvedConfig(LOCAL_FALLBACK_CONNECTION_STRING, "LOCAL_FALLBACK");
}

export function resolveDatabaseConnectionString(): string {
  return resolveDatabaseConfig().connectionString;
}
