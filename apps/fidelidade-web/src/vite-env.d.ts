/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

type ImportMetaEnv = {
  /** Base URL of @fidelidade/api. Defaults to http://localhost:1338. */
  readonly VITE_FIDELIDADE_API_URL?: string;
  /** Public origin of this web app, used for OAuth callback URLs. */
  readonly VITE_FIDELIDADE_CLIENT_URL?: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
