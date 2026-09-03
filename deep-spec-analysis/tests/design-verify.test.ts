// Conformance suite for the phase-2 design verification backends
// (design IR contract 3, compile-down reuse of the v1 backends).
//
// The canonical fixture (one unit, a native state machine) plants one defect
// per design check family: a nondeterministic same-(state,trigger) pair, a
// dead-guard transition, a mutually redundant rule pair, a rule-invariant
// the machine reachably violates, an unreachable state, and uncovered
// state x trigger cells (with one explicit ignore that must NOT report).
// Both backends must reproduce the expected contract-2 findings
// BYTE-FOR-BYTE, twice (NFR1), degrade cleanly, and keep the requirements
// loop untouched (a v1 model never fires the design sensors and vice versa).
// The design IR schema's shared definitions must remain byte-identical to
// contract 1 (FR15.4).
//
// The quint backend is forced to `simulation` (fixed seed) — bounded mode
// (Apalache) is exercised live on the sandbox, not in CI goldens.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalStringify } from "@deep-spec/kernel-adapter";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
// スキーマ原本はソースツリー側（src/entries/data/）。toolsDir は生成される配布物の
// spawn 先で、原本の置き場ではない。
const dataDir = join(pluginRoot, "src", "entries", "data");
const fixtures = join(pluginRoot, "tests", "fixtures", "design");
const expected = join(fixtures, "expected");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");

const nodeAvailable = ((): boolean => {
  const res = spawnSync("node", ["--version"], { encoding: "utf-8", timeout: 10_000 });
  return !res.error && res.status === 0;
})();

const quintEnv = {
  AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation",
  AIDLC_DEEP_SPEC_QUINT_BIN: quintBin,
};

interface SensorRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function fire(tool: string, modelPath: string, env: { [k: string]: string } = {}): SensorRun {
  const res = spawnSync("bun", [join(toolsDir, tool), "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath], {
    encoding: "utf-8",
    timeout: 240_000,
    env: { ...process.env, ...env },
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function makeRecord(): { record: string; modelPath: string; verifyDir: string } {
  const record = join(tmpdir(), `deep-spec-design-${Math.random().toString(36).slice(2)}`);
  cpSync(join(fixtures, "record"), record, { recursive: true });
  const stageDir = join(record, "construction", "deep-spec-analysis-functional-verify");
  return {
    record,
    modelPath: join(stageDir, "deep-spec-analysis-functional-formal-model.md"),
    verifyDir: join(stageDir, "deep-spec-design-verify"),
  };
}

describe("deep-spec-design-ir-valid", () => {
  test("passes the canonical fixture", () => {
    const { modelPath } = makeRecord();
    const run = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("rejects the invalid fixture with each planted defect", () => {
    const { modelPath } = makeRecord();
    cpSync(join(fixtures, "invalid-formal-model.md"), modelPath);
    const run = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout);
    expect(verdict.pass).toBe(false);
    const all = verdict.errors.join("\n");
    expect(all).toContain('duplicate id "TR-1"');
    expect(all).toContain('initial state "archived"');
    expect(all).toContain("assigns the machine's own attribute");
    expect(all).toContain('brRef "BR9.9" does not exist');
    expect(all).toContain("BR coverage: rule BR1.3");
    expect(all).toContain("int attributes require min and max");
    expect(all).toContain('enum literal "email" is not a value of "ticket.status"');
    expect(all).toContain("no construction/u9-ghost/ directory exists");
  });

  test("passes through writes that are not the functional formal model", () => {
    const { record } = makeRecord();
    const other = join(record, "construction", "deep-spec-analysis-functional-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    const run = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", other);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, note: "not-applicable" });
  });
});

describe("design backend conformance (expected findings, byte-for-byte)", () => {
  test("smt backend reproduces expected smt.json", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available — smt child cannot run");
      return;
    }
    const { modelPath, verifyDir } = makeRecord();
    const run = fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 7, method: "exhaustive" });
    expect(readFileSync(join(verifyDir, "smt.json"), "utf-8")).toBe(readFileSync(join(expected, "smt.json"), "utf-8"));
  });

  test("quint backend (simulation) reproduces expected quint.json and the cross-check converges", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available — the smt sibling is part of the cross-check surface");
      return;
    }
    const { modelPath, verifyDir } = makeRecord();
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    const run = fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, quintEnv);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 1, method: "simulation" });
    expect(readFileSync(join(verifyDir, "quint.json"), "utf-8")).toBe(readFileSync(join(expected, "quint.json"), "utf-8"));
    expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8")).toBe(readFileSync(join(expected, "cross-check.json"), "utf-8"));

    // Second run of every backend is byte-identical (NFR1 determinism).
    const before = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    expect(fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, quintEnv).status).toBe(0);
    const after = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(after).toEqual(before);
  }, 240_000);

  test("the planted defects surface with their design kinds and per-unit attribution", () => {
    const doc = JSON.parse(readFileSync(join(expected, "smt.json"), "utf-8"));
    const byKind = (k: string): { targets: string[] }[] => doc.findings.filter((f: { kind: string }) => f.kind === k);
    expect(byKind("conflict")[0]?.targets).toEqual(["TR-1", "TR-2"]);
    expect(byKind("unreachable")[0]?.targets).toEqual(["TR-4"]);
    expect(byKind("redundancy")[0]?.targets).toEqual(["DOB-3", "DOB-4"]);
    expect(byKind("completeness-gap").length).toBe(4);
    expect(doc.findings.every((f: { unit: string }) => f.unit === "u1-tickets")).toBe(true);
    // The (closed, close) ignore never reports: no gap witness carries closed/close.
    const closeGap = doc.findings.find((f: { detail: string }) => f.detail.includes('"close"'));
    expect(JSON.stringify(closeGap.witness)).not.toContain('"closed"');
  });

  test("a machine declaring deterministic:false waives its overlap conflict", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available");
      return;
    }
    const { modelPath, verifyDir } = makeRecord();
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace('"deterministic": true', '"deterministic": false'));
    const run = fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath);
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    expect(doc.findings.some((f: { kind: string; targets: string[] }) => f.kind === "conflict" && f.targets.includes("TR-1"))).toBe(false);
    for (const t of ["TR-1", "TR-2"]) {
      expect(doc.skipped.some((s: { target: string; reason: string }) => s.target === t && s.reason === "waived")).toBe(true);
    }
  });
});

describe("contract separation (design vs requirements)", () => {
  test("the shared schema definitions are byte-identical to contract 1 (FR15.4)", () => {
    const c1 = JSON.parse(readFileSync(join(dataDir, "deep-spec-ir-schema.json"), "utf-8"));
    const c3 = JSON.parse(readFileSync(join(dataDir, "deep-spec-design-ir-schema.json"), "utf-8"));
    for (const key of ["identifier", "attrPath", "frRef", "frRefs", "entity", "attribute", "attrType", "temporalSpec"]) {
      expect(canonicalStringify(c3.definitions[key])).toBe(canonicalStringify(c1.definitions[key]));
    }
    // expr differs only in one documentation string (prime legality mentions
    // transitions); the structural grammar must be identical.
    const stripDesc = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, val) => (k === "description" ? undefined : val)));
    expect(canonicalStringify(stripDesc(c3.definitions.expr) as never)).toBe(canonicalStringify(stripDesc(c1.definitions.expr) as never));
  });

  test("a v1 requirements model never fires the design sensors, and vice versa", () => {
    const { record } = makeRecord();
    const v1Model = join(record, "deep-spec-analysis-formal-model.md");
    cpSync(join(pluginRoot, "tests", "fixtures", "conformance", "deep-spec-analysis-formal-model.md"), v1Model);
    for (const tool of [
      "aidlc-sensor-deep-spec-design-ir-valid.ts",
      "aidlc-sensor-deep-spec-design-verify-smt.ts",
      "aidlc-sensor-deep-spec-design-verify-quint.ts",
    ]) {
      expect(JSON.parse(fire(tool, v1Model).stdout)).toMatchObject({ pass: true, note: "not-applicable" });
    }
    const { modelPath } = makeRecord();
    for (const tool of [
      "aidlc-sensor-deep-spec-ir-valid.ts",
      "aidlc-sensor-deep-spec-verify-smt.ts",
      "aidlc-sensor-deep-spec-verify-quint.ts",
    ]) {
      expect(JSON.parse(fire(tool, modelPath).stdout)).toMatchObject({ pass: true, note: "not-applicable" });
    }
  });

  test("a document without irKind: design degrades to unavailable, not a guess", () => {
    const { modelPath, verifyDir } = makeRecord();
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace('"irKind": "design",\n', ""));
    const run = fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath);
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    expect(doc.unavailable.reason).toContain("not a design IR");
  });
});

describe("degradation (NFR — no failure blocks the stage)", () => {
  test("quint backend degrades to `unavailable` when the CLI is missing", () => {
    const { modelPath, verifyDir } = makeRecord();
    const run = fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, {
      AIDLC_DEEP_SPEC_QUINT_BIN: "/nonexistent/quint",
    });
    expect(run.status).toBe(127);
    const doc = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    expect(doc.unavailable.reason.toLowerCase()).toContain("quint");
    expect(doc.skipped.length).toBeGreaterThan(0);
    expect(doc.skipped.every((s: { reason: string; unit: string }) => s.reason === "unavailable" && s.unit === "u1-tickets")).toBe(true);
  });

  test("a design-IR major version mismatch skips every target with the reason", () => {
    const { modelPath, verifyDir } = makeRecord();
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace('"irVersion": "1.0.0"', '"irVersion": "2.0.0"'));
    const run = fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, quintEnv);
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    expect(doc.findings.length).toBe(0);
    expect(doc.skipped.length).toBeGreaterThan(0);
    expect(doc.skipped.every((s: { reason: string }) => s.reason === "ir-version-mismatch")).toBe(true);
  });
});
