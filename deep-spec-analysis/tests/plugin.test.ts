// Content validation for the deep-spec-analysis plugin (FR12.3).
//
// Runs the framework's offline validator against this authored root. The
// framework checkout is expected as a sibling directory (`aidlc-workflows`,
// this repository's submodule) or via AIDLC_WORKFLOWS_CHECKOUT.

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function checkoutDir(): string | null {
  const candidates = [process.env.AIDLC_WORKFLOWS_CHECKOUT, join(pluginRoot, "..", "aidlc-workflows")];
  for (const c of candidates) {
    if (c && existsSync(join(c, "core", "tools", "aidlc-plugin-validate.ts"))) return c;
  }
  return null;
}

test("plugin content passes aidlc-plugin-validate", () => {
  const checkout = checkoutDir();
  if (!checkout) {
    console.warn("SKIP: aidlc-workflows checkout not found (set AIDLC_WORKFLOWS_CHECKOUT)");
    return;
  }
  const res = spawnSync("bun", [join(checkout, "core", "tools", "aidlc-plugin-validate.ts"), pluginRoot], {
    encoding: "utf-8",
    timeout: 60_000,
  });
  expect(res.error).toBeUndefined();
  expect(`${res.stdout}\n${res.stderr}`).toContain("Plugin validation: VALID");
  expect(res.status).toBe(0);
});
