import { client } from "@/lib/hono";

export type AdminIdentity = { email: string } | null;

/**
 * Is the signed-in person an administrator?
 *
 * Answers `null` for 404 instead of throwing, because 404 is the API's way of
 * saying "no", not a failure. Every other status still throws: a 500 must not be
 * read as "not an admin", or a broken database would look exactly like a
 * revoked grant.
 */
async function getAdminIdentity(): Promise<AdminIdentity> {
  const response = await client.admin.me.$get();

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Não foi possível verificar o acesso");
  }

  return response.json();
}

export default getAdminIdentity;
