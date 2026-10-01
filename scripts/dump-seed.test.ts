// Writes generateSeed() output to data/generated/seed.json (demo snapshot / future Postgres import).
// Run: npm run seed:dump   (skipped in the normal test run)
import { it } from "vitest";
import fs from "node:fs";
import { generateSeed } from "../lib/seed";
it.skipIf(!process.env.DUMP_OUT)("dump seed", () => {
  fs.mkdirSync("data/generated", { recursive: true });
  fs.writeFileSync(process.env.DUMP_OUT!, JSON.stringify(generateSeed(), null, 1));
});
