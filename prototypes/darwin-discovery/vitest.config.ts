import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["prototypes/darwin-discovery/**/*.test.ts"] },
});
