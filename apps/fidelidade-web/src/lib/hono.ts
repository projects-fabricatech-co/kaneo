import type { AppType } from "@fidelidade/api";
import { hc } from "hono/client";

const apiUrl = `${(
  import.meta.env.VITE_FIDELIDADE_API_URL ?? "http://localhost:1338"
).replace(/\/+$/, "")}/api`;

export const client = hc<AppType>(apiUrl, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      headers: { ...init?.headers, "Content-Type": "application/json" },
      credentials: "include",
    }),
});
