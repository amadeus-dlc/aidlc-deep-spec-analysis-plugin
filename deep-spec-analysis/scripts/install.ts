#!/usr/bin/env bun
// install.ts — one-command installer for the deep-spec-analysis plugin.
//
// Automates the folder-drop flow documented in aidlc-workflows
// docs/reference/18-plugin-mechanism.md: build the harness projection with
// aidlc-plugin-build.ts, copy it into the target project (the drop IS the
// trust decision — there is no store trust gate on this path), then compose
// via `aidlc plugin sync` or, when the aidlc CLI is absent, by running the
// projection's hooks/compose.ts directly. Compose is idempotent, so
// re-running the installer is safe.
//
// Usage: bun deep-spec-analysis/scripts/install.ts --project <path>
//        [--harness claude] [--dry-run] [--skip-build]

import { cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const USAGE =
  "Usage: bun deep-spec-analysis/scripts/install.ts --project <path> [--harness <name>] [--dry-run] [--skip-build]";

interface PluginTarget {
  harnessName: string;
  harnessLeaf: string;
}

function fail(message: string): never {
  console.error(`install: ${message}`);
  process.exit(1);
}

function run(
  label: string,
  command: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): void {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with status ${result.status}`);
}

// ---- arguments --------------------------------------------------------------

let projectArg = "";
let harness = "claude";
let dryRun = false;
let skipBuild = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--project") projectArg = args[++i] ?? "";
  else if (arg === "--harness") harness = args[++i] ?? "";
  else if (arg === "--dry-run") dryRun = true;
  else if (arg === "--skip-build") skipBuild = true;
  else if (arg === "--help" || arg === "-h") {
    console.log(USAGE);
    process.exit(0);
  } else fail(`unknown argument "${arg}"\n${USAGE}`);
}
if (!projectArg) fail(`--project is required\n${USAGE}`);

// ---- workspace layout -------------------------------------------------------

const pluginRoot = dirname(import.meta.dir);
const workspaceRoot = dirname(pluginRoot);
const toolsDir = join(workspaceRoot, "aidlc-workflows", "core", "tools");
if (!existsSync(join(toolsDir, "aidlc-plugin-build.ts"))) {
  fail(
    `aidlc toolchain not found at ${toolsDir} — ` +
      "clone with --recurse-submodules or run: git submodule update --init",
  );
}

const targetsPath = [
  join(toolsDir, "data", "plugin-targets.json"),
  join(
    workspaceRoot,
    "aidlc-workflows",
    "dist",
    "claude",
    ".claude",
    "tools",
    "data",
    "plugin-targets.json",
  ),
].find(existsSync);
if (!targetsPath) fail("plugin-targets.json not found in the aidlc checkout");
const targets = JSON.parse(readFileSync(targetsPath, "utf-8")) as Record<
  string,
  PluginTarget
>;
const target = targets[harness];
if (!target) {
  fail(
    `unknown harness "${harness}" — expected one of: ${Object.keys(targets).sort().join(", ")}`,
  );
}

const projectDir = resolve(projectArg);
if (!existsSync(projectDir)) fail(`project not found: ${projectDir}`);
if (!existsSync(join(projectDir, target.harnessLeaf))) {
  fail(
    `${projectDir} has no ${target.harnessLeaf}/ — install AI-DLC v2 for the ` +
      `"${harness}" harness there first (see aidlc-workflows dist/${harness}/)`,
  );
}

// ---- build ------------------------------------------------------------------

const distDir = join(pluginRoot, "dist", harness);
if (skipBuild) {
  if (!existsSync(distDir)) fail(`--skip-build but ${distDir} does not exist`);
} else {
  run(`build dist/${harness}/`, [
    "bun",
    join(toolsDir, "aidlc-plugin-build.ts"),
    pluginRoot,
    harness,
  ]);
}

// ---- dry run ----------------------------------------------------------------

if (dryRun) {
  run("compose dry-run (target is not modified)", [
    "bun",
    join(toolsDir, "aidlc-plugin-test.ts"),
    pluginRoot,
    "--install",
    projectDir,
    "--harness",
    harness,
  ]);
  console.log("\n✓ dry run passed — rerun without --dry-run to install");
  process.exit(0);
}

// ---- drop + compose ---------------------------------------------------------

console.log(`\n▸ copy ${distDir} → ${projectDir}`);
cpSync(distDir, projectDir, { recursive: true });

const composeEnv = {
  AIDLC_PLUGIN_ROOT: distDir,
  AIDLC_PROJECT_DIR: projectDir,
  AIDLC_HARNESS_DIR: target.harnessLeaf,
  AIDLC_HARNESS_NAME: target.harnessName,
};
const aidlcBin = Bun.which("aidlc");
if (aidlcBin) {
  run("compose (aidlc plugin sync)", [aidlcBin, "plugin", "sync"], {
    cwd: projectDir,
    env: composeEnv,
  });
} else {
  run("compose (hooks/compose.ts)", ["bun", join(distDir, "hooks", "compose.ts")], {
    cwd: projectDir,
    env: composeEnv,
  });
}

// ---- verify -----------------------------------------------------------------

const sentinel = join(
  projectDir,
  target.harnessLeaf,
  "sensors",
  "aidlc-deep-spec-ir-valid.md",
);
if (!existsSync(sentinel)) {
  fail(`compose finished but ${sentinel} is missing — check the compose output above`);
}
console.log(
  `\n✓ installed into ${projectDir} (${target.harnessLeaf}/) — ` +
    "the deep-spec-analysis-verify stage is now part of Inception.\n" +
    "  Next: run /aidlc --doctor in that project to check solver availability.",
);
