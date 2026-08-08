import { vi } from "vitest";
import { auth } from "../../../apps/fidelidade-api/src/auth";

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

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
    // biome-ignore lint/suspicious/noExplicitAny: Better Auth's session return
    // type carries generated plugin fields we do not need to fabricate here.
  } as any);
}

export function mockAnonymousSession() {
  return vi.spyOn(auth.api, "getSession").mockResolvedValue(null);
}
