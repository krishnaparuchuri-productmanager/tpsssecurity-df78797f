// Unit tests: no network, no database. Safe to run anywhere.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "unit",
    root: path.resolve(__dirname, ".."),
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: { alias: { "@": path.resolve(__dirname, "../src") } },
});
