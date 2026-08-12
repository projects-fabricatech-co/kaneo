import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type AuditLogPage = InferResponseType<typeof client.admin.audit.$get>;

async function listAuditLog(page = 0) {
  const response = await client.admin.audit.$get({
    query: page > 0 ? { page: String(page) } : {},
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default listAuditLog;
