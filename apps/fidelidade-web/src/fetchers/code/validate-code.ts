import type { InferRequestType, InferResponseType } from "hono/client";
import { apiError } from "@/lib/api-error";
import { client } from "@/lib/hono";

export type ValidateCodeRequest = InferRequestType<
  typeof client.code.validate.$post
>["json"];

export type ValidateCodeResponse = InferResponseType<
  typeof client.code.validate.$post
>;

/**
 * Read-only. Answers "what is this code and can it be spent?" without spending
 * it, so the lojista sees what they are about to give away before committing.
 *
 * A spent or expired code still answers 200 — it describes itself and reports
 * `usable: false`. Only a code that does not exist is an error.
 */
async function validateCode(input: ValidateCodeRequest) {
  const response = await client.code.validate.$post({ json: input });

  if (!response.ok) {
    throw await apiError(response);
  }

  return response.json();
}

export default validateCode;
