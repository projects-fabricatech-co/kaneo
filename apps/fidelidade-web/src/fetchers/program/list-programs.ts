import type { InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type ListProgramsResponse = InferResponseType<
  typeof client.program.$get
>;

export type Program = ListProgramsResponse[number];

async function listPrograms(storeId: string) {
  const response = await client.program.$get({ query: { storeId } });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default listPrograms;
