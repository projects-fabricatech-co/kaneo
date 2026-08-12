import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";
import type { PublicCard } from "@/types/public-card";

/**
 * The customer's card, by the opaque token in their URL. Unauthenticated — the
 * token is the only credential.
 *
 * The response is asserted against the locally declared `PublicCard` rather than
 * inferred from the client, so the closed type stays the contract: a field the
 * server should never send has nowhere to land.
 */
async function getPublicCard(token: string): Promise<PublicCard> {
  const response = await client.public.card[":token"].$get({
    param: { token },
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return (await response.json()) as PublicCard;
}

export default getPublicCard;
