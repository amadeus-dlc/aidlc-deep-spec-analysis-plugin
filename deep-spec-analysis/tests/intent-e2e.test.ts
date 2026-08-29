// Intent-level integration suite — the deterministic end-to-end path.
//
// Replays the verified 2026-08-29 sandbox exercise on every test run:
// installer onto a vanilla AI-DLC install (store harness ⇒ nothing copied
// into the project root) → real intent minting via aidlc-utility.ts
// intent-create → scope routing (classic skips the stage, feature executes
// it) → all three sensors fired from the INSTALLED harness tree against the
// intent's real record → findings inspected.
//
// The LLM conversation layer (product-agent formalization, the A/B gate,
// report writing) is out of scope: fixtures/intent-e2e/ stands in for the
// LLM's outputs, exactly as fixtures do in the conformance suite. The quint
// backend is forced to `simulation` so the suite does not depend on a
// JVM+Apalache environment; its capability skips are asserted instead.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(pluginRoot, "..");
const aidlcDist = join(workspaceRoot, "aidlc-workflows", "dist", "claude");
const installer = join(pluginRoot, "scripts", "install.ts");
const fixtures = join(pluginRoot, "tests", "fixtures", "intent-e2e");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");

const nodeAvailable = ((): boolean => {
  const res = spawnSync("node", ["--version"], { encoding: "utf-8", timeout: 10_000 });
  return !res.error && res.status === 0;
})();

const quintEnv = {
  AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation",
  AIDLC_DEEP_SPEC_QUINT_BIN: quintBin,
};

let sandbox = "";
let installOk = false;

function inSandbox(
  command: string[],
  env: { [k: string]: string } = {},
): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(command[0], command.slice(1), {
    encoding: "utf-8",
    timeout: 180_000,
    cwd: sandbox,
    env: { ...process.env, ...env },
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

// The state file names each stage as `- [ ] <slug> — SKIP|EXECUTE`.
function stateOfNewestIntent(): string {
  const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
  const dirs = readdirSync(intentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
  expect(dirs.length).toBeGreaterThan(0);
  const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
  return readFileSync(join(intentsDir, active, "aidlc-state.md"), "utf-8");
}

beforeAll(() => {
  if (!existsSync(aidlcDist)) {
    throw new Error(
      `vanilla AI-DLC dist not found at ${aidlcDist} — init the aidlc-workflows submodule`,
    );
  }
  sandbox = mkdtempSync(join(tmpdir(), "deep-spec-intent-e2e-"));
  cpSync(aidlcDist, sandbox, { recursive: true });
  // Solver resolution: the installed sensors resolve z3-solver/quint from the
  // project root, so borrow this repository's exact-pinned node_modules.
  symlinkSync(join(pluginRoot, "node_modules"), join(sandbox, "node_modules"));
  const res = spawnSync("bun", [installer, "--project", sandbox], {
    encoding: "utf-8",
    timeout: 300_000,
  });
  installOk = res.status === 0;
  if (!installOk) {
    throw new Error(`installer failed (${res.status}): ${res.stderr || res.stdout}`);
  }
});

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

describe("installer onto a vanilla install", () => {
  test("composes the plugin without littering the project root", () => {
    expect(installOk).toBe(true);
    // Store harness: the projection must NOT be folder-dropped.
    for (const leftover of ["stages", "sensors", "tools", "contributions", "hooks"]) {
      expect(existsSync(join(sandbox, leftover))).toBe(false);
    }
    for (const sensor of [
      "aidlc-deep-spec-ir-valid.md",
      "aidlc-deep-spec-verify-smt.md",
      "aidlc-deep-spec-verify-quint.md",
    ]) {
      expect(existsSync(join(sandbox, ".claude", "sensors", sensor))).toBe(true);
    }
    const graph = readFileSync(join(sandbox, ".claude", "tools", "data", "stage-graph.json"), "utf-8");
    expect(graph).toContain("deep-spec-analysis-verify");
  });
});

describe("intent minting and scope routing", () => {
  test("a classic-scope intent skips the stage", () => {
    const res = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-utility.ts"), "intent-create",
      "--scope", "classic",
      "--arguments", "在庫引当サービスのintent-e2e検証（classic）",
      "--label", "intent-e2e classic",
    ]);
    expect(res.status).toBe(0);
    expect(stateOfNewestIntent()).toContain("deep-spec-analysis-verify — SKIP");
  });

  test("a feature-scope intent puts the stage on-path", () => {
    const res = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-utility.ts"), "intent-create",
      "--scope", "feature",
      "--arguments", "在庫引当サービスのintent-e2e検証（feature）",
      "--label", "intent-e2e feature",
    ]);
    expect(res.status).toBe(0);
    expect(stateOfNewestIntent()).toContain("deep-spec-analysis-verify — EXECUTE");
  });
});

describe("sensors against the real intent record", () => {
  let record = "";
  let modelPath = "";
  let verifyDir = "";

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    record = join(intentsDir, active);
    mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
    mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
    cpSync(join(fixtures, "requirements.md"), join(record, "inception", "requirements-analysis", "requirements.md"));
    modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), modelPath);
    verifyDir = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
  });

  function fireInstalledSensor(tool: string, env: { [k: string]: string } = {}) {
    return inSandbox(
      ["bun", join(sandbox, ".claude", "tools", tool), "--stage", "deep-spec-analysis-verify", "--output-path", modelPath],
      env,
    );
  }

  test("ir-valid passes the formalized model", () => {
    const run = fireInstalledSensor("aidlc-sensor-deep-spec-ir-valid.ts");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("smt finds every planted conflict and the completeness gap", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — skipping SMT assertions");
      return;
    }
    const run = fireInstalledSensor("aidlc-sensor-deep-spec-verify-smt.ts");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 4 });

    const smt = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    const conflicts = smt.findings
      .filter((f: { kind: string }) => f.kind === "conflict")
      .map((f: { frRefs: string[] }) => [...f.frRefs].sort().join("+"))
      .sort();
    expect(conflicts).toEqual(["FR-1+FR-2", "FR-1+FR-3", "FR-2+FR-3"]);
    const gaps = smt.findings.filter((f: { kind: string }) => f.kind === "completeness-gap");
    expect(gaps).toHaveLength(1);
    expect([...gaps[0].frRefs].sort()).toEqual(["FR-1", "FR-2", "FR-3"]);
  });

  test("quint skips When-event scenarios explicitly and stays consistent", () => {
    const run = fireInstalledSensor("aidlc-sensor-deep-spec-verify-quint.ts", quintEnv);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ findings_count: 0, skipped_count: 2 });

    const quint = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    expect(quint.findings).toHaveLength(0);
    for (const skip of quint.skipped) expect(skip.reason).toBe("capability");

    const cross = JSON.parse(readFileSync(join(verifyDir, "cross-check.json"), "utf-8"));
    expect(cross.findings).toHaveLength(0);
    expect(cross.crossChecked).toHaveLength(0);
  });
});
