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

import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const USAGE =
  "Usage: bun deep-spec-analysis/scripts/install.ts --project <path> [--harness <name>] [--dry-run] [--skip-build]";

interface PluginTarget {
  harnessName: string;
  harnessLeaf: string;
  // "store" hosts (claude, codex, copilot, opencode) keep the plugin outside
  // the project, so compose reads straight from dist/ and nothing is copied.
  // The storeless kinds (kiro, kiro-ide, cursor) expect the projection
  // folder-dropped into the project root.
  kind: "store" | "kiro" | "kiro-ide" | "cursor";
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

// ---- upgrade refresh --------------------------------------------------------
// The compose hook copies payload files no-clobber: new files land, but a
// file that already exists in the harness tree is never overwritten. That is
// the right default for a user-owned tree — and the wrong one for a plugin
// UPGRADE, where it leaves the previous version's schema and tools coexisting
// with the new version's files. The skew is not hypothetical: a newly added
// sensor loading a stale findings schema self-validates against the old
// contract and degrades every document it writes to `unavailable`. Before
// composing, remove the plugin's OWN payload files from the harness tree so
// compose re-places the current versions. Only files this plugin's projection
// ships are touched; contribution merges into core stages are content-based
// and refresh themselves.

const PAYLOAD_MAP: [string, string[]][] = [
  ["sensors", ["sensors"]],
  ["tools", ["tools"]],
  ["knowledge", ["knowledge"]],
  ["agents", ["agents"]],
  ["scopes", ["scopes"]],
  ["stages", ["aidlc-common", "stages"]],
];

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) visit(p);
      else out.push(relative(root, p));
    }
  };
  visit(root);
  return out.sort();
}

function refreshPluginPayloads(): number {
  let refreshed = 0;
  for (const [srcDir, dstParts] of PAYLOAD_MAP) {
    const srcRoot = join(distDir, srcDir);
    if (!existsSync(srcRoot)) continue;
    for (const rel of walkFiles(srcRoot)) {
      const dst = join(projectDir, target.harnessLeaf, ...dstParts, rel);
      if (existsSync(dst)) {
        rmSync(dst, { force: true });
        refreshed += 1;
      }
    }
  }
  return refreshed;
}

// 廃止済みペイロードの tombstone: かつて配布し、もう dist に存在しないファイル。
// compose は no-clobber・refresh は「現 dist に在るもの」しか消せないため、
// ここに載せない限りアップグレード先へ孤児として残り続ける。後方互換の残骸を
// 残さない——ファイルを廃止したら同じ変更でこのリストに追記すること。
const REMOVED_PAYLOADS: string[][] = [
  ["tools", "deep-spec-lib.ts"], // DDD 移行 PR2a で refcheck/ と kernel/ へ解体
];

function removeTombstonedPayloads(): number {
  let removed = 0;
  for (const parts of REMOVED_PAYLOADS) {
    const dst = join(projectDir, target.harnessLeaf, ...parts);
    if (existsSync(dst)) {
      rmSync(dst, { force: true });
      removed += 1;
    }
  }
  return removed;
}

const refreshed = refreshPluginPayloads();
if (refreshed > 0) {
  console.log(
    `\n▸ upgrade refresh: removed ${refreshed} previously composed plugin file(s) so compose re-places the current versions`,
  );
}
const tombstoned = removeTombstonedPayloads();
if (tombstoned > 0) {
  console.log(
    `\n▸ upgrade cleanup: removed ${tombstoned} retired plugin file(s) that this version no longer ships`,
  );
}

// ---- drop (storeless harnesses only) + compose ------------------------------

if (target.kind === "store") {
  console.log(
    `\n▸ ${harness} is a store harness — composing directly from dist/, nothing is copied into the project`,
  );
} else {
  console.log(`\n▸ copy ${distDir} → ${projectDir} (folder-drop, ${target.kind} layout)`);
  cpSync(distDir, projectDir, { recursive: true });
}

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

// Late-adoption safety net: immediately surface every existing intent whose
// requirements the plugin can verify but has not — instead of leaving that
// discovery to human attention. The installed doctor owns the scan; render
// its verification-coverage rows here.
const doctor = spawnSync(
  "bun",
  [join(projectDir, target.harnessLeaf, "tools", "deep-spec-analysis-doctor.ts")],
  {
    encoding: "utf-8",
    timeout: 60_000,
    cwd: projectDir,
    env: {
      ...process.env,
      AIDLC_PROJECT_DIR: projectDir,
      AIDLC_HARNESS_DIR: target.harnessLeaf,
    },
  },
);
if (doctor.status === 0) {
  try {
    const rows: { pass: boolean; label: string; fix?: string }[] =
      JSON.parse(doctor.stdout).checks;
    const debt = rows.filter(
      (c) => !c.pass && (c.label.includes("no deep-spec verification") || c.label.includes("after the last deep-spec verification")),
    );
    if (debt.length > 0) {
      console.log("\n⚠ Existing intents with unverified requirements:");
      for (const row of debt) {
        console.log(`  - ${row.label}`);
        if (row.fix) console.log(`    → ${row.fix}`);
      }
    } else {
      const summary = rows.find((c) => c.label.includes("verification coverage"));
      if (summary) console.log(`\n${summary.label}`);
    }
  } catch {
    console.log("⚠ could not parse the doctor's coverage report — run /aidlc --doctor manually");
  }
} else {
  console.log("⚠ doctor coverage scan failed — run /aidlc --doctor manually");
}
