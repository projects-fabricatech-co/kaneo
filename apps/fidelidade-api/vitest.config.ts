import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/fidelidade-api/**/*.test.ts"],
    coverage: {
      enabled: false,
    },
  },
  esbuild: {
    target: "node18",
  },
});
