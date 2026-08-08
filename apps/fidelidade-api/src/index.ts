import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { config } from "dotenv-mono";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import db from "./database";
import store from "./store";
import { authenticateApiRequest } from "./utils/authenticate-api-request";

config();

const currentDir = dirname(fileURLToPath(import.meta.url));

type ApiVariables = {
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
    userEmail: string;
    storeId: string;
    storeRole: string;
  };
};

function resolveCorsOrigins(): string[] | null {
  const explicit = process.env.FIDELIDADE_CORS_ORIGINS?.trim();
  if (explicit) {
    const origins = explicit
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (origins.length > 0) {
      return origins;
    }
  }

  const clientUrl = process.env.FIDELIDADE_CLIENT_URL?.trim();
  return clientUrl ? [clientUrl] : null;
}

export function createApp() {
  const app = new Hono();

  // Registered first so it catches everything below it.
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // Note: `message` renders as PLAIN TEXT, while the `res` option lets a
      // route return a JSON body (used by the plan-limit 402s).
      return err.getResponse();
    }

    console.error("fidelidade: unhandled error", err);
    return c.json({ message: "Erro interno do servidor" }, 500);
  });

  const corsOrigins = resolveCorsOrigins();

  app.use(
    "*",
    cors({
      credentials: true,
      origin: (origin) => {
        if (!corsOrigins) {
          return origin || "*";
        }
        if (!origin) {
          return null;
        }
        return corsOrigins.includes(origin) ? origin : null;
      },
    }),
  );

  const api = new Hono<ApiVariables>();

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC routes. Everything registered before the auth gate below is
  // unauthenticated — registration order IS the security boundary.
  // ───────────────────────────────────────────────────────────────────────────

  api.get("/health", (c) => c.json({ status: "ok" }));

  api.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

  // Stripe delivers this one; it authenticates by signature, not by session.
  // The raw body must reach `constructEvent` byte-for-byte, so this route reads
  // `c.req.text()` and nothing may parse the body before it. Phase 6 fills in
  // the handler; until then the endpoint exists and reports it is disabled.
  api.post("/stripe/webhook", async (c) => {
    await c.req.text();
    throw new HTTPException(404, { message: "Not found" });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Auth gate. Everything registered AFTER this line requires a session.
  // ───────────────────────────────────────────────────────────────────────────
  api.use("*", async (c, next) => {
    try {
      await authenticateApiRequest(c);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error("fidelidade: authentication failed", error);
      throw new HTTPException(500, { message: "Erro interno do servidor" });
    }

    return next();
  });

  const storeApi = api.route("/store", store);

  app.route("/api", api);

  return { app, api, storeApi };
}

const { app, storeApi } = createApp();

export type AppType = typeof storeApi;

export default app;

async function runMigrations() {
  await db.execute(sql`select 1`);
  console.log("🔄 Migrando o banco de dados...");
  await migrate(db, { migrationsFolder: `${currentDir}/../drizzle` });
  console.log("✅ Banco de dados migrado!");
}

async function startServer() {
  try {
    await runMigrations();
  } catch (error) {
    console.error("❌ Falha ao migrar o banco de dados:", error);
    process.exit(1);
  }

  const port = Number(process.env.FIDELIDADE_PORT ?? 1338);
  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`🚀 Fidelidade API em http://localhost:${info.port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Only listen when executed directly. The integration suite imports
// `createApp()` and drives it with `app.request(...)`; without this guard it
// would open a real socket on 1338 and hang CI.
const isMainModule =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1] as string).href;

if (isMainModule) {
  void startServer();
}
