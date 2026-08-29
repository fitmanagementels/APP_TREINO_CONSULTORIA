import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("./worker/migrations");

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.test.json" },
    miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
  })],
  test: {
    include: ["tests/cloudflare/**/*.test.mjs"],
    setupFiles: ["tests/cloudflare/setup.mjs"],
  },
});
