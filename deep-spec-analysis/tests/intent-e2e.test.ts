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
let installOut = "";

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

  const res = spawnSync("bun", [installer, "--project", sandbox], {
    encoding: "utf-8",
    timeout: 300_000,
  });
  installOk = res.status === 0;
  installOut = res.stdout ?? "";
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

describe("phase-1 refcheck sensors compose and fire in the sandbox", () => {
  test("the refcheck sensors, tools, and shared lib are composed into the harness tree", () => {
    for (const sensor of [
      "aidlc-deep-spec-refcheck-domain.md",
      "aidlc-deep-spec-refcheck-contract.md",
      "aidlc-deep-spec-refcheck-functional.md",
    ]) {
      expect(existsSync(join(sandbox, ".claude", "sensors", sensor))).toBe(true);
    }
    for (const tool of [
      "aidlc-sensor-deep-spec-refcheck-domain.ts",
      "aidlc-sensor-deep-spec-refcheck-contract.ts",
      "aidlc-sensor-deep-spec-refcheck-functional.ts",
      "deep-spec-lib.ts",
    ]) {
      expect(existsSync(join(sandbox, ".claude", "tools", tool))).toBe(true);
    }
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

  test("the composed domain refcheck sensor finds the planted structural defects", () => {
    const intentsDir = join(sandbox, "aidlc", "spaces", "default", "intents");
    const active = readFileSync(join(intentsDir, "active-intent"), "utf-8").trim();
    const domainDir = join(intentsDir, active, "inception", "domain-design");
    mkdirSync(domainDir, { recursive: true });
    const componentsPath = join(domainDir, "components.md");
    cpSync(join(pluginRoot, "tests", "fixtures", "refcheck", "broken", "inception", "domain-design", "components.md"), componentsPath);
    const run = inSandbox([
      "bun", join(sandbox, ".claude", "tools", "aidlc-sensor-deep-spec-refcheck-domain.ts"),
      "--stage", "domain-design", "--output-path", componentsPath,
    ]);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, method: "static" });
    const doc = JSON.parse(readFileSync(join(domainDir, "deep-spec-refcheck", "components.json"), "utf-8"));
    const details = doc.findings.map((f: { detail: string }) => f.detail).join("\n");
    expect(details).toContain("DD-2");
    expect(details).toContain("dependency cycle");
    expect(doc.findings.every((f: { kind: string }) => ["structure-invalid", "reference-broken", "consistency-mismatch"].includes(f.kind))).toBe(true);
  });

  test("the doctor's report-only scan surfaces the structural debt", () => {
    const run = inSandbox(["bun", join(sandbox, ".claude", "tools", "deep-spec-analysis-doctor.ts")]);
    expect(run.status).toBe(0);
    const { checks } = JSON.parse(run.stdout) as { checks: { pass: boolean; label: string; severity: string }[] };
    const summary = checks.find((c) => c.label.includes("design refcheck —"));
    expect(summary).toBeDefined();
    expect(summary?.pass).toBe(false);
    const row = checks.find((c) => c.label.includes("components.md has") && c.label.includes("reference-integrity finding"));
    expect(row).toBeDefined();
    expect(row?.severity).toBe("advisory");
  });
});
