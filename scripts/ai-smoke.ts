// Deprecated entrypoint — use `npm run test:ai` (tests/ai-live.ts).
// Kept so older docs/muscle memory still work.
import { spawnSync } from "node:child_process";

const r = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--env-file-if-exists=.env.local",
    "--test",
    "--test-concurrency=1",
    "tests/ai-live.ts",
  ],
  { stdio: "inherit" }
);
process.exit(r.status ?? 1);
