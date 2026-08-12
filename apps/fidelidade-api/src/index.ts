import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { config } from "dotenv-mono";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import billing from "./billing";
import handleStripeWebhook from "./billing/controllers/handle-webhook";
import card from "./card";
import code from "./code";
import coupon from "./coupon";
import customer from "./customer";
import dashboard from "./dashboard";
import db from "./database";
import program from "./program";
import publicRoutes from "./public";
import reward from "./reward";
import stamp from "./stamp";
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

  // Ahead of CORS and every route: a body nobody will accept should not be
  // buffered first. The unauthenticated coupon claim took a 60 MB `phone` string
  // all the way to validation.
  app.use("*", bodyLimit({ maxSize: 64 * 1024 }));

  app.use(
    "*",
    cors({
      credentials: true,
      // FAILS CLOSED. With no allowlist configured this used to reflect whatever
      // origin asked, alongside `credentials: true` — a wildcard-with-credentials
      // branch that only failed to be exploitable because the session cookie is
      // SameSite=Lax. Relying on that is a load-bearing accident: the day the app
      // and the API live on unrelated domains, `sameSite: "none"` becomes
      // necessary and the accident stops covering. A missing allowlist is a
      // misconfiguration, and the safe answer to a misconfiguration is "no".
      origin: (origin) => {
        if (!corsOrigins || !origin) {
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
  // `c.req.text()` and nothing may parse the body before it — a JSON parse and
  // re-serialise anywhere upstream changes the bytes and every signature fails.
  api.post("/stripe/webhook", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("stripe-signature") ?? null;
    const result = await handleStripeWebhook(rawBody, signature);
    return c.json(result);
  });

  // The customer's own card, opened from a link or a QR code. Unauthenticated by
  // design, so its controller projects an explicit allowlist of fields.
  const publicApi = api.route("/public", publicRoutes);

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
  const programApi = api.route("/program", program);
  const customerApi = api.route("/customer", customer);
  const cardApi = api.route("/card", card);
  const stampApi = api.route("/stamp", stamp);
  const rewardApi = api.route("/reward", reward);
  const codeApi = api.route("/code", code);
  const couponApi = api.route("/coupon", coupon);
  const dashboardApi = api.route("/dashboard", dashboard);
  const billingApi = api.route("/billing", billing);

  app.route("/api", api);

  return {
    app,
    api,
    publicApi,
    storeApi,
    programApi,
    customerApi,
    cardApi,
    stampApi,
    rewardApi,
    codeApi,
    couponApi,
    dashboardApi,
    billingApi,
  };
}

const {
  app,
  publicApi,
  storeApi,
  programApi,
  customerApi,
  cardApi,
  stampApi,
  rewardApi,
  codeApi,
  couponApi,
  dashboardApi,
  billingApi,
} = createApp();

/**
 * A UNION, not an intersection, and each member has to come from its own `const`.
 * `api.route()` returns a Hono typed with only the schema of the router that call
 * registered, so capturing every call and unioning them is what gives the web
 * client's `hc<AppType>` a complete map of the API. Dropping a member here does
 * not fail to compile — it silently deletes those routes from the client's types.
 */
export type AppType =
  | typeof publicApi
  | typeof storeApi
  | typeof programApi
  | typeof customerApi
  | typeof cardApi
  | typeof stampApi
  | typeof rewardApi
  | typeof codeApi
  | typeof couponApi
  | typeof dashboardApi
  | typeof billingApi;

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
