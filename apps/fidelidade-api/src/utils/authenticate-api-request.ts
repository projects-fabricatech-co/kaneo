import { APIError } from "better-auth/api";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";

function isAuthRejection(error: unknown) {
  if (!(error instanceof APIError)) {
    return false;
  }
  const status = typeof error.statusCode === "number" ? error.statusCode : 0;
  return status >= 400 && status < 500;
}

async function getSession(headers: Headers) {
  try {
    return await auth.api.getSession({ headers });
  } catch (error) {
    if (isAuthRejection(error)) {
      return null;
    }
    throw error;
  }
}

async function getSessionFromBearerOnlyHeaders(c: Context) {
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");

  return getSession(headers);
}

function parseBearerToken(authHeader: string | undefined): {
  token: string | null;
  malformed: boolean;
} {
  if (!authHeader) {
    return { token: null, malformed: false };
  }

  if (!authHeader.match(/^Bearer\b/i)) {
    return { token: null, malformed: false };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) {
    return { token: null, malformed: true };
  }

  return { token: match[1], malformed: false };
}

/**
 * Resolves the caller from a Bearer session token or the session cookie. There
 * is no API-key path in Fidelidade — shop owners use the app, not integrations.
 */
export async function authenticateApiRequest(c: Context): Promise<void> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));

  if (malformed) {
    throw new HTTPException(401, {
      message: "Sua sessão expirou. Entre novamente.",
    });
  }

  if (token) {
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);

    if (sessionResult?.user && sessionResult.session) {
      c.set("user", sessionResult.user);
      c.set("session", sessionResult.session);
      c.set("userId", sessionResult.user.id);
      c.set("userEmail", sessionResult.user.email ?? "");
      return;
    }

    throw new HTTPException(401, {
      message: "Sua sessão expirou. Entre novamente.",
    });
  }

  const sessionResult = await getSession(c.req.raw.headers);

  c.set("user", sessionResult?.user ?? null);
  c.set("session", sessionResult?.session ?? null);
  c.set("userId", sessionResult?.user?.id ?? "");
  c.set("userEmail", sessionResult?.user?.email ?? "");

  if (!sessionResult?.user) {
    throw new HTTPException(401, {
      message: "Sua sessão expirou. Entre novamente.",
    });
  }
}
