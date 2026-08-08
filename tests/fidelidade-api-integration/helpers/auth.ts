import { vi } from "vitest";
import { auth } from "../../../apps/fidelidade-api/src/auth";

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * What `auth.api.getSession` actually resolves to. Better Auth generates this
 * type from the enabled plugins, so naming it here lets the fixture below cast
 * once, precisely, instead of reaching for `any`.
 */
type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Stubs the session resolver so route tests do not need real cookies. This is
 * the seam `authenticateApiRequest` goes through, so everything above it (the
 * auth gate, storeAccess, requireStoreRole) runs for real.
 */
export function mockAuthenticatedSession(user: SessionUser) {
  const now = new Date();

  return vi.spyOn(auth.api, "getSession").mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      image: null,
    },
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
  } as SessionResult);
}

export function mockAnonymousSession() {
  return vi.spyOn(auth.api, "getSession").mockResolvedValue(null);
}
