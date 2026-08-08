import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import { config } from "dotenv-mono";
import db, { schema } from "./database";

config();

const apiUrl = process.env.FIDELIDADE_API_URL || "http://localhost:1338";
const clientUrl = process.env.FIDELIDADE_CLIENT_URL || "http://localhost:5174";

const baseURLWithoutPath = (() => {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/");
  }
})();

const trustedOrigins = [clientUrl];
try {
  const apiOrigin = new URL(apiUrl);
  const apiOriginString = `${apiOrigin.protocol}//${apiOrigin.host}`;
  if (!trustedOrigins.includes(apiOriginString)) {
    trustedOrigins.push(apiOriginString);
  }
} catch {}

const secret =
  process.env.FIDELIDADE_AUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "";

const googleClientId = process.env.FIDELIDADE_GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.FIDELIDADE_GOOGLE_CLIENT_SECRET?.trim();

// Better Auth rejects a provider registered with empty credentials, so the
// provider only exists when both halves are configured.
const socialProviders =
  googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : {};

export const auth = betterAuth({
  baseURL: baseURLWithoutPath,
  trustedOrigins,
  secret,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders,
  advanced: {
    // CRITICAL: cookies ignore the port, so Kaneo on localhost:5173 and
    // Fidelidade on localhost:5174 share one cookie jar. With the default
    // `better-auth.session_token` name each login would silently evict the
    // other product's session.
    cookiePrefix: "fidelidade",
  },
  plugins: [bearer(), openAPI()],
});
