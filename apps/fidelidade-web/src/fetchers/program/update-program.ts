import type { InferRequestType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type UpdateProgramRequest = InferRequestType<
  (typeof client.program)[":id"]["$put"]
>["json"];

async function updateProgram(id: string, input: UpdateProgramRequest) {
  const response = await client.program[":id"].$put({
    param: { id },
    json: input,
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default updateProgram;
