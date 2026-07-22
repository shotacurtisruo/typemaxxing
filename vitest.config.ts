import { defineConfig } from "vitest/config"

// Game logic is pure TS; jsdom gives us window + localStorage for the
// persistence/migration tests. No React rendering is exercised here.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./test-setup.ts"],
    restoreMocks: true,
  },
})
