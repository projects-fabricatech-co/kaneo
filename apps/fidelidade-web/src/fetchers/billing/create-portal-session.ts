import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

async function createPortalSession() {
  const response = await client.billing.portal.$post();

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default createPortalSession;
