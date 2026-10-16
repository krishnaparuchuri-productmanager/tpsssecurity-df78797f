// API / database tests against the SANDBOX database through its public interface,
// as signed-out or signed-in test users. The target guard runs first (globalSetup).
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "api",
    root: path.resolve(__dirname, ".."),
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/api/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
});
