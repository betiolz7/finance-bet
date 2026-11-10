import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Cada teste de banco inicia um Postgres em memória.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
