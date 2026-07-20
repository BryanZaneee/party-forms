import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const e2eDb = path.join(mkdtempSync(path.join(tmpdir(), "party-te-e2e-")), "e2e.db");

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  // Keep Playwright artifacts out of the repo (no root test-results/ folder).
  outputDir: path.join(tmpdir(), "party-te-playwright-output"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Port 3001 avoids colliding with a local `npm run dev` on 3000.
    command: "npm run build && npx next start -p 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    env: {
      ...process.env,
      PARTY_TE_DB: e2eDb,
      // Deterministic E2E must not call live AI unless AI_E2E=1
      ...(process.env.AI_E2E ? {} : { MOONSHOT_API_KEY: "", ANTHROPIC_API_KEY: "" }),
    },
    timeout: 180_000,
  },
});
