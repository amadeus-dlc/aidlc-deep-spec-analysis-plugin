// Content validation for the deep-spec-analysis plugin (FR12.3).
//
// Runs the framework's offline validator against this authored root using
// the AI-DLC 2.8.2 development fixture (see the repository Development guide).

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("plugin content passes aidlc-plugin-validate", () => {
  const checkout = process.env.AIDLC_WORKFLOWS_CHECKOUT ?? join(pluginRoot, "..", ".cache", "aidlc-workflows");
  const validator = join(checkout, "core", "tools", "aidlc-plugin-validate.ts");
  if (!existsSync(validator)) {
    throw new Error(`AI-DLC validator not found at ${validator} — follow the repository Development guide`);
  }
  const res = spawnSync("bun", [validator, pluginRoot], {
    encoding: "utf-8",
    timeout: 60_000,
  });
  expect(res.error).toBeUndefined();
  expect(`${res.stdout}\n${res.stderr}`).toContain("Plugin validation: VALID");
  expect(res.status).toBe(0);
});
