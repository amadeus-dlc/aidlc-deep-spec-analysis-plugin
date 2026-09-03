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
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
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

// 出荷形（FR2.1）: プラグインが harness へ運ぶのは entry バンドル 10 本と
// data/ の契約スキーマ 4 本の計 14 ファイルだけ。バンドルの中身は bundle 済み
// JS だが、上流ディスパッチャが manifest の command から .ts で終わるトークンを
// 探すのでファイル名は .ts のまま。旧構成の層ディレクトリはもう配布しないので、
// tombstone で消え compose 先に残らないことも表明する。
const PLUGIN_BUNDLES = [
  "aidlc-sensor-deep-spec-ir-valid.ts",
  "aidlc-sensor-deep-spec-verify-smt.ts",
  "aidlc-sensor-deep-spec-verify-quint.ts",
  "aidlc-sensor-deep-spec-refcheck-domain.ts",
  "aidlc-sensor-deep-spec-refcheck-contract.ts",
  "aidlc-sensor-deep-spec-refcheck-functional.ts",
  "aidlc-sensor-deep-spec-design-ir-valid.ts",
  "aidlc-sensor-deep-spec-design-verify-smt.ts",
  "aidlc-sensor-deep-spec-design-verify-quint.ts",
  "deep-spec-analysis-doctor.ts",
];
const PLUGIN_SCHEMAS = [
  "deep-spec-ir-schema.json",
  "deep-spec-findings-schema.json",
  "deep-spec-design-ir-schema.json",
  "deep-spec-refinement-map-schema.json",
];
const PLUGIN_LAYER_DIRS = ["kernel", "requirements", "design", "refinement", "refcheck", "doctor"];

let sandbox = "";
let installOk = false;
let installOut = "";

// 導入先に置かれたプラグイン出荷物の指紋（名前＋内容ハッシュ）。再実行が
// 何も落とさず何も書き換えないことの比較基準。
function pluginToolsFingerprint(): string[] {
  const tools = join(sandbox, ".claude", "tools");
  const digest = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
  return [
    ...PLUGIN_BUNDLES.map((b) => `${b}:${digest(join(tools, b))}`),
    ...PLUGIN_SCHEMAS.map((s) => `data/${s}:${digest(join(tools, "data", s))}`),
  ].sort();
}

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

  // Late-adoption setup: mint one intent BEFORE the plugin exists, so the
  // suite can prove a project that adopted AI-DLC first and this plugin later
  // can still verify that intent's requirements.
  const legacy = spawnSync(
    "bun",
    [
      join(sandbox, ".claude", "tools", "aidlc-utility.ts"), "intent-create",
      "--scope", "feature",
      "--arguments", "プラグイン導入前から進行中のintent（後入れ検証用）",
      "--label", "intent-e2e legacy",
    ],
    { encoding: "utf-8", timeout: 180_000, cwd: sandbox },
  );
  if (legacy.status !== 0) {
    throw new Error(`pre-install intent-create failed: ${legacy.stderr || legacy.stdout}`);
  }
  // The legacy intent already has requirements when the plugin arrives — the
  // exact state whose verification debt the installer must surface.
  const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
  const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
  mkdirSync(join(intentsDir, active, "inception", "requirements-analysis"), { recursive: true });
  cpSync(
    join(fixtures, "requirements.md"),
    join(intentsDir, active, "inception", "requirements-analysis", "requirements.md"),
  );

  const res = spawnSync("bun", [installer, "--project", sandbox, "--from", workspaceRoot], {
    encoding: "utf-8",
    timeout: 300_000,
  });
  installOk = res.status === 0;
  installOut = res.stdout ?? "";
  if (!installOk) {
    throw new Error(`installer failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  // This hook spawns two engine processes (intent-create, then the installer
  // with its build and compose). bun's default 5 s hook budget is enough on a
  // developer machine (~0.6 s) but a loaded CI runner crossed it once and the
  // killed installer surfaced as `installer failed (null)`, so the hook gets
  // its own explicit budget, matching the spawn timeouts above.
}, { timeout: 300_000 });

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

  test("same-source update is Changed 0 and preserves provenance bytes and mtime", () => {
    const provenance = join(sandbox, ".claude", "tools", "data", "deep-spec-analysis-install.json");
    const beforeBytes = readFileSync(provenance);
    const beforeMtime = Bun.file(provenance).lastModified;
    const result = spawnSync("bun", [installer, "--project", sandbox, "--update"], {
      encoding: "utf-8",
      timeout: 300_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Changed 0");
    expect(readFileSync(provenance)).toEqual(beforeBytes);
    expect(Bun.file(provenance).lastModified).toBe(beforeMtime);
  });
});

describe("late adoption — the plugin verifies an intent that predates it", () => {
  let legacyRecord = "";

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    legacyRecord = join(intentsDir, active);
  });

  test("the pre-install intent's plan does not know the stage", () => {
    const state = readFileSync(join(legacyRecord, "aidlc-state.md"), "utf-8");
    expect(state).not.toContain("deep-spec-analysis-verify");
  });

  test("the installer surfaces the pre-existing intent's verification debt", () => {
    // Late adoption must not rely on human attention: the install itself
    // names the unverified intent and the exact command to verify it.
    expect(installOut).toContain("has requirements with no deep-spec verification");
    expect(installOut).toContain("deep-spec-analysis-verify --single");
  });

  test("after the late install, the single-stage engine run accepts that intent", () => {
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-orchestrate.ts"),
      "next", "--stage", "deep-spec-analysis-verify", "--single",
    ]);
    expect(run.status).toBe(0);
    const directive = JSON.parse(run.stdout.trim().split("\n")[0]);
    expect(directive.kind).toBe("load-steering");
    expect(directive.stage).toBe("deep-spec-analysis-verify");
  });

  test("the sensors detect the contradictions in the pre-existing intent's record", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — skipping late-adoption SMT assertions");
      return;
    }
    const verify = join(legacyRecord, "inception", "deep-spec-analysis-verify");
    mkdirSync(verify, { recursive: true });
    const model = join(verify, "deep-spec-analysis-formal-model.md");
    cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), model);
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor-deep-spec-verify-smt.ts"),
      "--stage", "deep-spec-analysis-verify", "--output-path", model,
    ]);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 5 });
    const smt = JSON.parse(readFileSync(join(verify, "deep-spec-verify", "smt.json"), "utf-8"));
    const kinds = smt.findings.map((f: { kind: string }) => f.kind).sort();
    expect(kinds).toEqual([
      "completeness-gap",
      "conflict",
      "conflict",
      "conflict",
      "scenario-violation",
    ]);
  });

  test("the doctor's coverage row flips to verified once the sensors have run", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — the coverage flip depends on the SMT run above");
      return;
    }
    const run = inSandbox(
      ["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")],
      { AIDLC_PROJECT_DIR: sandbox, AIDLC_HARNESS_DIR: ".claude" },
    );
    expect(run.status).toBe(0);
    const rows: { pass: boolean; label: string }[] = JSON.parse(run.stdout).checks;
    const summary = rows.find((c) => c.label.includes("verification coverage"));
    expect(summary?.pass).toBe(true);
    expect(summary?.label).toContain("1/1 eligible intents verified");
    expect(rows.some((c) => c.label.includes("no deep-spec verification"))).toBe(false);
  });
});

// The sourceDigest anchor scenario: requirements.md is edited AFTER a
// verification, and the model file's mtime is pushed into the future so the
// old mtime heuristic would swear the verification is fresh. The content
// hash must still catch the drift — through the real dispatcher (ir-valid
// refuses the model) and through the doctor (the intent turns stale).
describe("sourceDigest anchoring — requirements drift is caught by content, not mtime", () => {
  let record = "";
  let requirements = "";
  let model = "";
  let original = "";

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    record = join(intentsDir, active);
    requirements = join(record, "inception", "requirements-analysis", "requirements.md");
    model = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    original = readFileSync(requirements, "utf-8");
    // The late-adoption SMT test is node-gated; make the verified state
    // deterministic here regardless (model present + at least one findings
    // file — the doctor only checks presence).
    const verifyDir = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
    mkdirSync(verifyDir, { recursive: true });
    if (!existsSync(model)) cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), model);
    if (!readdirSync(verifyDir).some((f) => f.endsWith(".json"))) {
      cpSync(join(pluginRoot, "tests", "fixtures", "conformance", "expected", "quint.json"), join(verifyDir, "quint.json"));
    }
    // Drift the source, then make the mtime heuristic lie about it.
    writeFileSync(requirements, `${original}\n- FR-9: 監査ログを5年間保持しなければならない。\n`);
    const future = new Date(Date.now() + 3_600_000);
    utimesSync(model, future, future);
  });

  afterAll(() => {
    // Restore, so every later doctor scan sees this intent verified again.
    writeFileSync(requirements, original);
  });

  test("the real dispatcher refuses the model against the drifted requirements", () => {
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor.ts"),
      "fire", "deep-spec-ir-valid", "--stage", "deep-spec-analysis-verify", "--output-path", model,
    ]);
    expect(run.status).toBe(0);
    const lines = run.stdout.trim().split("\n");
    expect(JSON.parse(lines[lines.length - 1] ?? "{}")).toMatchObject({ result: "failed" });
  });

  test("the sensor names the drift and hands back the expected digest", () => {
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor-deep-spec-ir-valid.ts"),
      "--stage", "deep-spec-analysis-verify", "--output-path", model,
    ]);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout) as { pass: boolean; errors: string[] };
    expect(verdict.pass).toBe(false);
    const all = verdict.errors.join("\n");
    expect(all).toContain("sourceDigest");
    expect(all).toMatch(/does not match requirements\.md \(sha256 [0-9a-f]{64}\)/);
  });

  test("the doctor flags the intent stale even though the model mtime is fresher", () => {
    const run = inSandbox(
      ["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")],
      { AIDLC_PROJECT_DIR: sandbox, AIDLC_HARNESS_DIR: ".claude" },
    );
    expect(run.status).toBe(0);
    const rows: { pass: boolean; label: string }[] = JSON.parse(run.stdout).checks;
    expect(rows.some((c) => c.label.includes("changed its requirements after the last deep-spec verification"))).toBe(true);
  });

  test("restoring the exact source text clears the staleness without re-running", () => {
    writeFileSync(requirements, original);
    const run = inSandbox(
      ["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")],
      { AIDLC_PROJECT_DIR: sandbox, AIDLC_HARNESS_DIR: ".claude" },
    );
    expect(run.status).toBe(0);
    const rows: { pass: boolean; label: string }[] = JSON.parse(run.stdout).checks;
    expect(rows.some((c) => c.label.includes("changed its requirements after the last deep-spec verification"))).toBe(false);
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

  interface Finding {
    kind: string;
    frRefs: string[];
    targets?: string[];
    detail: string;
    witness?: { core?: string[]; model?: Record<string, unknown>; trace?: Record<string, unknown>[] };
  }

  function dumpFindings(backend: string, findings: Finding[]) {
    for (const f of findings) {
      console.log(`[${backend}] ${f.kind} ${f.frRefs.join("+")} (${(f.targets ?? []).join(",")}) — ${f.detail}`);
      if (f.witness) console.log(`  witness: ${JSON.stringify(f.witness)}`);
    }
  }

  test("smt finds the conflicts, the gap, and the broken scenario — with evidence", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — skipping SMT assertions");
      return;
    }
    const run = fireInstalledSensor("aidlc-sensor-deep-spec-verify-smt.ts");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 5 });

    const smt = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    const findings: Finding[] = smt.findings;
    dumpFindings("smt", findings);

    // Every finding carries human-readable detail.
    for (const f of findings) expect(f.detail.length).toBeGreaterThan(20);

    // Three same-trigger conflicts, each attributed to its FR pair via an unsat core.
    const conflicts = findings.filter((f) => f.kind === "conflict");
    expect(conflicts.map((f) => [...f.frRefs].sort().join("+")).sort()).toEqual([
      "FR-1+FR-2",
      "FR-1+FR-3",
      "FR-2+FR-3",
    ]);
    for (const c of conflicts) expect(c.witness?.core?.length).toBe(2);

    // One completeness gap with a concrete witness state over every attribute.
    const gaps = findings.filter((f) => f.kind === "completeness-gap");
    expect(gaps).toHaveLength(1);
    expect([...gaps[0].frRefs].sort()).toEqual(["FR-1", "FR-2", "FR-3"]);
    expect(Object.keys(gaps[0].witness?.model ?? {}).sort()).toEqual([
      "order.blocked",
      "order.expensive",
      "order.qty",
      "order.status",
      "order.stock",
    ]);

    // The broken accept SC-5 is rejected by the OB-4 invariant.
    const violations = findings.filter((f) => f.kind === "scenario-violation");
    expect(violations).toHaveLength(1);
    expect(violations[0].targets).toContain("OB-4");
    expect(violations[0].targets).toContain("SC-5");

    // When-event scenarios are an explicit v1 capability skip, never silent.
    expect(smt.skipped.map((s: { target: string }) => s.target).sort()).toEqual(["SC-1", "SC-2"]);
    for (const s of smt.skipped) expect(s.reason).toBe("capability");
  });

  test("quint finds the unpreserved invariant via a step trace and agrees on the broken scenario", () => {
    const run = fireInstalledSensor("aidlc-sensor-deep-spec-verify-quint.ts", quintEnv);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 2 });

    const quint = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    const findings: Finding[] = quint.findings;
    dumpFindings("quint", findings);

    // The event machine reaches a state violating OB-4 (a blocked order gets
    // allocated by OB-1) — evidenced by an attached step trace ending in the
    // violating state. This is the state-machine lens the SMT backend lacks.
    const conflicts = findings.filter((f) => f.kind === "conflict");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].targets).toContain("OB-4");
    const trace = conflicts[0].witness?.trace ?? [];
    expect(trace.length).toBeGreaterThanOrEqual(2);
    expect(trace[trace.length - 1]["order.status"]).toBe("allocated");
    expect(trace[trace.length - 1]["order.blocked"]).toBe(true);

    // Same SC-5 verdict as the SMT backend, with a concrete witness model.
    const violations = findings.filter((f) => f.kind === "scenario-violation");
    expect(violations).toHaveLength(1);
    expect(violations[0].targets).toContain("SC-5");
    expect(violations[0].witness?.model?.["order.blocked"]).toBe(true);

    // Explicit capability skips: When-event scenarios and the partial-bindings reject.
    expect(quint.skipped.map((s: { target: string }) => s.target).sort()).toEqual(["SC-1", "SC-2", "SC-4"]);
    for (const s of quint.skipped) expect(s.reason).toBe("capability");
  });

  test("cross-check compares both backends' scenario verdicts and finds agreement", () => {
    const cross = JSON.parse(readFileSync(join(verifyDir, "cross-check.json"), "utf-8"));
    console.log(`[cross-check] crossChecked: ${JSON.stringify(cross.crossChecked)}`);
    // Both backends checked SC-3 (legal) and SC-5 (broken); no disagreement findings.
    for (const backend of ["smt", "quint"]) {
      const entry = cross.crossChecked.find((e: { backend: string }) => e.backend === backend);
      expect(entry?.targets?.sort()).toEqual(["SC-3", "SC-5"]);
    }
    expect(cross.findings).toHaveLength(0);
  });
});

describe("phase-1 refcheck sensors compose into the sandbox", () => {
  test("the refcheck sensors and the shipped bundles are composed into the harness tree", () => {
    for (const sensor of [
      "aidlc-deep-spec-refcheck-domain.md",
      "aidlc-deep-spec-refcheck-contract.md",
      "aidlc-deep-spec-refcheck-functional.md",
    ]) {
      expect(existsSync(join(sandbox, ".claude", "sensors", sensor))).toBe(true);
    }
    // 出荷形は entry バンドル 10 本＋data/ のスキーマ 4 本の計 14 ファイルだけ。
    // 層ツリーはソース側（src/）にしか無く、compose の対象ではない。
    const tools = join(sandbox, ".claude", "tools");
    for (const bundle of PLUGIN_BUNDLES) {
      expect(existsSync(join(tools, bundle))).toBe(true);
    }
    for (const schema of PLUGIN_SCHEMAS) {
      expect(existsSync(join(tools, "data", schema))).toBe(true);
    }
    for (const legacy of PLUGIN_LAYER_DIRS) {
      expect(existsSync(join(tools, legacy))).toBe(false);
    }
    // プラグインが tools/ に持ち込むのはこの 14 ファイルちょうど（他は core の
    // 出荷物）。deep-spec を名に持つものを数え、ディレクトリが 0 であることも見る。
    const owned = readdirSync(tools, { withFileTypes: true }).filter((e) => e.name.includes("deep-spec"));
    expect(owned.filter((e) => e.isDirectory())).toHaveLength(0);
    expect(owned.map((e) => e.name).sort()).toEqual([...PLUGIN_BUNDLES].sort());
    // data/ には core の compose 台帳（plugin-files-*.json など）も同居するので、
    // プラグインが持ち込む契約スキーマだけを名前の形で切り出して数える。
    expect(
      readdirSync(join(tools, "data"), { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.startsWith("deep-spec-") && e.name.endsWith("-schema.json"))
        .map((e) => e.name)
        .sort(),
    ).toEqual([...PLUGIN_SCHEMAS].sort());
    expect(owned.length + PLUGIN_SCHEMAS.length).toBe(14);
  });

  test("the contributions wire the refcheck sensors into the core design stages", () => {
    const stages: [string, string][] = [
      ["inception/domain-design.md", "deep-spec-refcheck-domain"],
      ["inception/contract-design.md", "deep-spec-refcheck-contract"],
      ["construction/functional-design.md", "deep-spec-refcheck-functional"],
    ];
    for (const [stage, sensor] of stages) {
      const composed = readFileSync(join(sandbox, ".claude", "aidlc-common", "stages", stage), "utf-8");
      expect(composed).toContain(sensor);
    }
  });
});

// The full new-feature scenario, driven through the REAL sensor dispatcher
// (aidlc-sensor.ts fire) — the exact path a stage write triggers in
// production, including the manifest glob filters (`**/functional-design/*.md`
// on the dispatcher's bespoke matcher): a design record planted with one
// defect per artifact family is verified, the doctor reports the debt (also
// for a unit nothing fired on), the artifacts are fixed, and the loop closes
// with every family checked and the doctor quiet again.
describe("phase-1 refcheck scenario — a defective design record through the real dispatcher, then fixed", () => {
  const refcheckFixtures = join(pluginRoot, "tests", "fixtures", "refcheck");
  let record = "";

  const DESIGN_FILES: string[][] = [
    ["inception", "domain-design", "components.md"],
    ["inception", "contract-design", "contract-summary.md"],
    ["inception", "units-generation", "unit-of-work-dependency.md"],
    ["construction", "u1-orders", "functional-design", "entities.md"],
    ["construction", "u1-orders", "functional-design", "rules.md"],
    ["construction", "u1-orders", "functional-design", "functional-spec.md"],
    ["construction", "u2-billing", "functional-design", "entities.md"],
  ];

  const FIRES: [string, string, string[]][] = [
    ["deep-spec-refcheck-domain", "domain-design", ["inception", "domain-design", "components.md"]],
    ["deep-spec-refcheck-contract", "contract-design", ["inception", "contract-design", "contract-summary.md"]],
    ["deep-spec-refcheck-functional", "functional-design", ["construction", "u1-orders", "functional-design", "entities.md"]],
  ];

  function copyDesignRecord(variant: "broken" | "clean"): void {
    for (const rel of DESIGN_FILES) {
      const dst = join(record, ...rel);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(join(refcheckFixtures, variant, ...rel), dst);
    }
  }

  function dispatcherFire(sensorId: string, stage: string, outputPath: string): { result: string } {
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor.ts"),
      "fire", sensorId, "--stage", stage, "--output-path", outputPath,
    ]);
    expect(run.status).toBe(0); // sensor outcomes are advisory — only dispatch errors exit non-zero
    const lines = run.stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1] ?? "{}") as { result: string };
  }

  function readFindings(rel: string[]): {
    findings: { kind: string; detail: string; unit?: string }[];
    checked: string[];
    unavailable?: { reason: string };
  } {
    return JSON.parse(readFileSync(join(record, ...rel), "utf-8"));
  }

  function doctorChecks(): { pass: boolean; label: string }[] {
    const run = inSandbox(["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")]);
    expect(run.status).toBe(0);
    return (JSON.parse(run.stdout) as { checks: { pass: boolean; label: string }[] }).checks;
  }

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    record = join(intentsDir, active);
    copyDesignRecord("broken");
  });

  test("the dispatcher accepts all three sensors (glob filters pass) and each reports findings", () => {
    for (const [id, stage, rel] of FIRES) {
      expect(dispatcherFire(id, stage, join(record, ...rel)).result).toBe("failed");
    }
  });

  test("each findings document carries the planted defects, never a degraded file", () => {
    const domain = readFindings(["inception", "domain-design", "deep-spec-refcheck", "components.json"]);
    const details = (d: { findings: { detail: string }[] }): string => d.findings.map((f) => f.detail).join("\n");
    expect(domain.unavailable).toBeUndefined();
    expect(details(domain)).toContain("dependency cycle");
    expect(details(domain)).toContain("GhostService");

    const contract = readFindings(["inception", "contract-design", "deep-spec-refcheck", "contract-summary.json"]);
    expect(contract.unavailable).toBeUndefined();
    expect(details(contract)).toContain("ghost-unit");
    expect(details(contract)).toContain('"u3-ui" -> "u1-orders"');

    const functional = readFindings(["construction", "u1-orders", "functional-design", "deep-spec-refcheck", "functional-design.json"]);
    expect(functional.unavailable).toBeUndefined();
    expect(details(functional)).toContain("FR-99");
    expect(details(functional)).toContain("cancelled");
    expect(details(functional)).toContain("ownership is duplicated");
    expect(functional.findings.every((f) => f.unit === "u1-orders")).toBe(true);
  });

  test("the doctor lists every defective artifact — including the unit nothing fired on", () => {
    const checks = doctorChecks();
    const labels = checks
      .filter((c) => c.label.includes("reference-integrity finding"))
      .map((c) => c.label)
      .join("\n");
    expect(labels).toContain("components.md");
    expect(labels).toContain("contract-summary.md");
    expect(labels).toContain("u1-orders/functional-design");
    expect(labels).toContain("u2-billing/functional-design");
    const summary = checks.find((c) => c.label.includes("design refcheck —"));
    expect(summary?.pass).toBe(false);
  });

  test("fixing the artifacts closes the loop: sensors pass, all families checked, doctor quiet", () => {
    copyDesignRecord("clean");
    for (const [id, stage, rel] of FIRES) {
      expect(dispatcherFire(id, stage, join(record, ...rel)).result).toBe("passed");
    }
    const domain = readFindings(["inception", "domain-design", "deep-spec-refcheck", "components.json"]);
    expect(domain.findings).toHaveLength(0);
    expect(domain.checked).toHaveLength(8);
    const functional = readFindings(["construction", "u1-orders", "functional-design", "deep-spec-refcheck", "functional-design.json"]);
    expect(functional.findings).toHaveLength(0);
    expect(functional.checked).toHaveLength(16);

    const checks = doctorChecks();
    expect(checks.filter((c) => c.label.includes("reference-integrity finding"))).toHaveLength(0);
    const summary = checks.find((c) => c.label.includes("design refcheck —"));
    expect(summary?.pass).toBe(true);
  });
});

describe("upgrade path — re-running the installer refreshes stale plugin files", () => {
  // The framework's compose hook copies payload files no-clobber: a plugin
  // UPGRADE would otherwise leave the previous version's schema and tools in
  // the harness tree next to the new version's files. The skew is fatal in a
  // quiet way: a new sensor self-validating against a stale findings schema
  // degrades every document it writes to `unavailable`. Discovered on a real
  // sandbox (a tmp-fresh install can never hit it); the installer now removes
  // its own payload files before composing.
  test("a stale composed findings schema is re-placed by the installer", () => {
    const schema = join(sandbox, ".claude", "tools", "data", "deep-spec-findings-schema.json");
    expect(readFileSync(schema, "utf-8")).toContain('"static"');
    writeFileSync(schema, '{"stale": true}\n');
    const res = spawnSync("bun", [installer, "--project", sandbox, "--skip-build"], {
      encoding: "utf-8",
      timeout: 300_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("upgrade refresh");
    expect(readFileSync(schema, "utf-8")).toContain('"static"');
    // The refreshed tree still verifies end-to-end: the composed sensor runs
    // against the (now clean) record and writes a healthy, non-degraded doc.
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    const record = join(intentsDir, active);
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor-deep-spec-refcheck-domain.ts"),
      "--stage", "domain-design", "--output-path", join(record, "inception", "domain-design", "components.md"),
    ]);
    expect(run.status).toBe(0);
    const doc = JSON.parse(
      readFileSync(join(record, "inception", "domain-design", "deep-spec-refcheck", "components.json"), "utf-8"),
    ) as { checked: string[]; unavailable?: unknown };
    expect(doc.unavailable).toBeUndefined();
    expect(doc.checked).toHaveLength(8);
  });

  test("a retired payload file from a previous version is tombstoned away on upgrade", () => {
    // compose は no-clobber・refresh は現 dist の同名ファイルしか消せないため、
    // 廃止ファイルは tombstone（REMOVED_PAYLOADS）が消す。後方互換の残骸を
    // アップグレード先に残さないことの回帰証明。
    const retired = join(sandbox, ".claude", "tools", "deep-spec-lib.ts");
    writeFileSync(retired, "// v0.5.x までの合成物を装った孤児\n");
    const res = spawnSync("bun", [installer, "--project", sandbox, "--skip-build"], {
      encoding: "utf-8",
      timeout: 300_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("upgrade cleanup");
    expect(existsSync(retired)).toBe(false);
  });

  // 出荷形が「層ツリー ＋ 素の entry」から「bundle 済み entry ＋ data/」へ移った
  // 以上、アップグレード先に旧構成が残っていてはならない。entry のファイル名は
  // 変わらないので旧 entry は upgrade refresh が現行版へ置き換え、二度と配布され
  // ない層ディレクトリは tombstone が消す——経路は違うが、結果はどちらも 14
  // ファイルちょうど。ディスパッチャは basename で解決するので、旧実装が 1 本でも
  // 残れば新バンドルより先に掴まれ得る。
  test("the previous version's orphan entries and layer directories are cleaned away on upgrade", () => {
    const tools = join(sandbox, ".claude", "tools");
    for (const bundle of PLUGIN_BUNDLES) {
      writeFileSync(join(tools, bundle), "// v0.5.x の孤児 entry\n");
    }
    for (const dir of PLUGIN_LAYER_DIRS) {
      mkdirSync(join(tools, dir, "domain"), { recursive: true });
      writeFileSync(join(tools, dir, "domain", "index.ts"), "// v0.5.x の孤児 facade\n");
    }
    const res = spawnSync("bun", [installer, "--project", sandbox, "--skip-build"], {
      encoding: "utf-8",
      timeout: 300_000,
    });
    expect(res.status).toBe(0);
    // 層ディレクトリは tombstone 経路、旧 entry は refresh 経路で消える。
    expect(res.stdout).toContain("upgrade cleanup");
    expect(res.stdout).toContain("upgrade refresh");
    // プラグインが tools/ 直下に残すのはバンドル 10 本だけ（層ディレクトリは 0）。
    const named = readdirSync(tools, { withFileTypes: true }).filter((e) => e.name.includes("deep-spec"));
    expect(named.filter((e) => e.isDirectory())).toHaveLength(0);
    expect(named.map((e) => e.name).sort()).toEqual([...PLUGIN_BUNDLES].sort());
    for (const dir of PLUGIN_LAYER_DIRS) expect(existsSync(join(tools, dir))).toBe(false);
    for (const schema of PLUGIN_SCHEMAS) expect(existsSync(join(tools, "data", schema))).toBe(true);
    // 孤児が 1 本も残らず、出荷形は 14 ファイルちょうどに戻っている。
    expect(named.length + PLUGIN_SCHEMAS.length).toBe(14);
    // 置き換えられた entry は孤児のプレースホルダではなく現行のバンドル。
    for (const bundle of PLUGIN_BUNDLES) {
      expect(readFileSync(join(tools, bundle), "utf-8")).not.toContain("v0.5.x の孤児 entry");
    }
  });

  test("a second run drops nothing and leaves the shipped bytes untouched", () => {
    const before = pluginToolsFingerprint();
    const res = spawnSync("bun", [installer, "--project", sandbox, "--skip-build"], {
      encoding: "utf-8",
      timeout: 300_000,
    });
    expect(res.status).toBe(0);
    // 孤児が無いので tombstone は 1 件も動かない（動けば冪等でない）。
    expect(res.stdout).not.toContain("upgrade cleanup");
    expect(pluginToolsFingerprint()).toEqual(before);
  });
});

// Phase-2 scenario: the functional-verify stage composes into the graph and
// routes by scope; the engine accepts a late-adoption --single run; the
// composed design backends verify a native state-machine model through the
// REAL dispatcher; and the doctor tracks per-unit design-verification
// coverage through unverified -> verified -> stale.
describe("phase-2 design verification — routing, single-run, dispatcher fire, unit coverage", () => {
  const designFixtures = join(pluginRoot, "tests", "fixtures", "design");
  let record = "";
  let stageDir = "";
  let modelPath = "";

  function doctorChecksP2(): { pass: boolean; label: string }[] {
    const run = inSandbox(["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")]);
    expect(run.status).toBe(0);
    return (JSON.parse(run.stdout) as { checks: { pass: boolean; label: string }[] }).checks;
  }

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    record = join(intentsDir, active);
    stageDir = join(record, "construction", "deep-spec-analysis-functional-verify");
    modelPath = join(stageDir, "deep-spec-analysis-functional-formal-model.md");
    // A third unit with a functional-design record (its rules.md feeds the
    // ir-valid BR coverage check and the doctor eligibility scan).
    const fd = join(record, "construction", "u1-tickets", "functional-design");
    mkdirSync(fd, { recursive: true });
    cpSync(join(designFixtures, "record", "construction", "u1-tickets", "functional-design", "rules.md"), join(fd, "rules.md"));
  });

  test("the functional-verify stage is in the compiled graph and routes by scope", () => {
    const graph = readFileSync(join(sandbox, ".claude", "tools", "data", "stage-graph.json"), "utf-8");
    expect(graph).toContain("deep-spec-analysis-functional-verify");
    expect(stateOfNewestIntent()).toContain("deep-spec-analysis-functional-verify — EXECUTE");
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const classicState = readdirSync(intentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        try {
          return readFileSync(join(intentsDir, e.name, "aidlc-state.md"), "utf-8");
        } catch {
          return "";
        }
      })
      .find((s) => s.includes("**Scope**: classic"));
    expect(classicState).toBeDefined();
    expect(classicState).toContain("deep-spec-analysis-functional-verify — SKIP");
  });

  test("the doctor reports every unit as unverified before any design verification", () => {
    const checks = doctorChecksP2();
    expect(checks.some((c) => c.label.includes("/u1-tickets has functional-design artifacts with no deep-spec design verification"))).toBe(true);
    const summary = checks.find((c) => c.label.includes("design verification coverage"));
    expect(summary?.pass).toBe(false);
    expect(summary?.label).toContain("0/3 eligible units verified");
  });

  test("the engine accepts a single-stage run for the functional verify stage", () => {
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-orchestrate.ts"),
      "next", "--stage", "deep-spec-analysis-functional-verify", "--single",
    ]);
    expect(run.status).toBe(0);
    const directive = JSON.parse(run.stdout.trim().split("\n")[0]);
    expect(directive.kind).toBe("load-steering");
    expect(directive.stage).toBe("deep-spec-analysis-functional-verify");
  });

  test("the composed design backends verify the native state-machine model through the dispatcher", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — skipping design-backend assertions");
      return;
    }
    mkdirSync(stageDir, { recursive: true });
    cpSync(
      join(designFixtures, "record", "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"),
      modelPath,
    );
    const fireP2 = (id: string, env: { [k: string]: string } = {}): { result: string } => {
      const run = inSandbox([
        "bun", join(sandbox, ".claude", "tools", "aidlc-sensor.ts"),
        "fire", id, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath,
      ], env);
      expect(run.status).toBe(0);
      const lines = run.stdout.trim().split("\n");
      return JSON.parse(lines[lines.length - 1] ?? "{}") as { result: string };
    };
    expect(fireP2("deep-spec-design-ir-valid").result).toBe("passed");
    expect(fireP2("deep-spec-design-verify-smt").result).toBe("failed");
    expect(fireP2("deep-spec-design-verify-quint", {
      AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation",
      AIDLC_DEEP_SPEC_QUINT_BIN: join(sandbox, "node_modules", ".bin", "quint"),
    }).result).toBe("failed");
    const smt = JSON.parse(readFileSync(join(stageDir, "deep-spec-design-verify", "smt.json"), "utf-8"));
    const kinds = new Set(smt.findings.map((f: { kind: string }) => f.kind));
    expect(kinds.has("conflict")).toBe(true);
    expect(kinds.has("unreachable")).toBe(true);
    expect(kinds.has("redundancy")).toBe(true);
    expect(kinds.has("completeness-gap")).toBe(true);
    expect(smt.findings.every((f: { unit: string }) => f.unit === "u1-tickets")).toBe(true);
    // Per-unit completion evidence: the doctor's verified verdict rests on this.
    expect(smt.checked).toEqual(["unit:u1-tickets"]);
  });

  test("the doctor's per-unit coverage flips to verified, then stale after an artifact touch", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — coverage depends on the backend run above");
      return;
    }
    let checks = doctorChecksP2();
    let summary = checks.find((c) => c.label.includes("design verification coverage"));
    expect(summary?.label).toContain("1/3 eligible units verified");
    expect(checks.some((c) => c.label.includes("/u1-tickets has functional-design artifacts"))).toBe(false);

    const rules = join(record, "construction", "u1-tickets", "functional-design", "rules.md");
    writeFileSync(rules, `${readFileSync(rules, "utf-8")}\n<!-- touched -->\n`);
    checks = doctorChecksP2();
    expect(checks.some((c) => c.label.includes("/u1-tickets changed its functional-design artifacts after the last design verification"))).toBe(true);
    summary = checks.find((c) => c.label.includes("design verification coverage"));
    expect(summary?.label).toContain("0/3 eligible units verified");
  });
});

// Phase-3 scenario: with a verified requirements model and a human-gated
// refinement map in place, the composed design backends run the refinement
// checks through the REAL dispatcher, and the doctor flags refinement-stale
// evidence when the requirements are re-verified afterwards.
describe("phase-3 refinement — dispatcher fire and refinement-stale coverage", () => {
  const refFixtures = join(pluginRoot, "tests", "fixtures", "refinement", "record");
  let record = "";
  let stageDir = "";
  let modelPath = "";
  let reqModelPath = "";

  beforeAll(() => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    record = join(intentsDir, active);
    stageDir = join(record, "construction", "deep-spec-analysis-functional-verify");
    modelPath = join(stageDir, "deep-spec-analysis-functional-formal-model.md");
    reqModelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    mkdirSync(join(record, "construction", "u1-orders", "functional-design"), { recursive: true });
    cpSync(join(refFixtures, "construction", "u1-orders", "functional-design", "rules.md"),
      join(record, "construction", "u1-orders", "functional-design", "rules.md"));
    mkdirSync(dirname(reqModelPath), { recursive: true });
    cpSync(join(refFixtures, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"), reqModelPath);
    mkdirSync(stageDir, { recursive: true });
    cpSync(join(refFixtures, "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-functional-formal-model.md"), modelPath);
    cpSync(join(refFixtures, "construction", "deep-spec-analysis-functional-verify", "deep-spec-analysis-refinement-map.md"),
      join(stageDir, "deep-spec-analysis-refinement-map.md"));
  });

  test("the composed backends run the refinement checks through the dispatcher", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — skipping refinement assertions");
      return;
    }
    const fireP3 = (id: string): { result: string } => {
      const run = inSandbox([
        "bun", join(sandbox, ".claude", "tools", "aidlc-sensor.ts"),
        "fire", id, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath,
      ]);
      expect(run.status).toBe(0);
      const lines = run.stdout.trim().split("\n");
      return JSON.parse(lines[lines.length - 1] ?? "{}") as { result: string };
    };
    expect(fireP3("deep-spec-design-ir-valid").result).toBe("passed");
    expect(fireP3("deep-spec-design-verify-smt").result).toBe("failed");
    const smt = JSON.parse(readFileSync(join(stageDir, "deep-spec-design-verify", "smt.json"), "utf-8"));
    const kinds = new Set(smt.findings.map((f: { kind: string }) => f.kind));
    expect(kinds.has("refinement-violation")).toBe(true);
    expect(kinds.has("mapping-gap")).toBe(true);
    const rv = smt.findings.find((f: { kind: string }) => f.kind === "refinement-violation");
    expect(rv.targets).toContain("OB-1");
    expect(rv.frRefs).toContain("FR-1");
    expect((smt.inputs ?? []).length).toBe(3);
    expect(smt.skipped.some((s: { target: string; reason: string }) => s.target === "OB-3" && s.reason === "waived")).toBe(true);
  });

  test("the doctor flags refinement-stale evidence after the requirements are re-verified", () => {
    if (!nodeAvailable) {
      console.warn("node runtime missing — depends on the run above");
      return;
    }
    const run1 = inSandbox(["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")]);
    const before = (JSON.parse(run1.stdout) as { checks: { label: string }[] }).checks;
    expect(before.some((c) => c.label.includes("refinement evidence is stale"))).toBe(false);

    writeFileSync(reqModelPath, `${readFileSync(reqModelPath, "utf-8")}\n<!-- re-verified -->\n`);
    const run2 = inSandbox(["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")]);
    const after = (JSON.parse(run2.stdout) as { checks: { label: string; fix?: string }[] }).checks;
    const row = after.find((c) => c.label.includes("refinement evidence is stale"));
    expect(row).toBeDefined();
    expect(row?.fix).toContain("deep-spec-analysis-functional-verify --single");
  });
});
