import { createAuthClient } from "better-auth/react";

const getBaseURL = () => {
  const apiUrl =
    import.meta.env.VITE_FIDELIDADE_API_URL ?? "http://localhost:1338";
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/");
  }
};

/**
 * No plugins: the Fidelidade API registers only `bearer()` and `openAPI()`.
 * Email+password and the Google social provider are core Better Auth features,
 * so nothing extra is needed on the client.
 */
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  basePath: "/api/auth",
});
