import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type CreateProgramRequest = InferRequestType<
  typeof client.program.$post
>["json"];

async function createProgram(input: CreateProgramRequest) {
  const response = await client.program.$post({ json: input });

  if (!response.ok) {
    // 402 here means the plan's active-program ceiling was reached.
    throw await apiError(response);
  }

  return response.json();
}

export default createProgram;
