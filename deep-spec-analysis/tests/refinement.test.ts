// Conformance suite for the phase-3 refinement checks (contract 4).
//
// The fixture pairs a verified requirements IR with a design IR whose entity
// model deliberately lacks the invariant the requirements demand, plus a
// human-gated refinement map that plants one case per check family: a static
// AND reachable invariant break (OB-1), an admitted reject scenario (SC-2),
// an enabledness hole (the requirements event applies in a design state
// where no mapped transition is enabled), a waived obligation (OB-3 via
// unmapped[]), and an attribute-closure violation (order.note, neither
// mapped nor unmapped). Both backends must reproduce expected contract-2
// findings BYTE-FOR-BYTE, twice, and degrade to explicit skips — never
// silence — when the map is absent or stale.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures", "refinement");
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

function fire(tool: string, modelPath: string, env: { [k: string]: string } = {}): { status: number | null; stdout: string } {
  const res = spawnSync("bun", [join(toolsDir, tool), "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath], {
    encoding: "utf-8",
    timeout: 240_000,
    env: { ...process.env, ...env },
  });
  return { status: res.status, stdout: res.stdout ?? "" };
}

function makeRecord(): { record: string; stageDir: string; modelPath: string; mapPath: string; verifyDir: string } {
  const record = join(tmpdir(), `deep-spec-refinement-${Math.random().toString(36).slice(2)}`);
  cpSync(join(fixtures, "record"), record, { recursive: true });
  const stageDir = join(record, "construction", "deep-spec-analysis-functional-verify");
  return {
    record,
    stageDir,
    modelPath: join(stageDir, "deep-spec-analysis-functional-formal-model.md"),
    mapPath: join(stageDir, "deep-spec-analysis-refinement-map.md"),
    verifyDir: join(stageDir, "deep-spec-design-verify"),
  };
}

describe("refinement conformance (expected findings, byte-for-byte)", () => {
  test("smt backend reproduces expected smt.json, quint follows, and both rerun byte-identically", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available — the z3 child cannot run");
      return;
    }
    const { modelPath, verifyDir } = makeRecord();
    const smtRun = fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath);
    expect(smtRun.status).toBe(0);
    expect(JSON.parse(smtRun.stdout)).toMatchObject({ pass: false, findings_count: 6, method: "exhaustive" });
    expect(readFileSync(join(verifyDir, "smt.json"), "utf-8")).toBe(readFileSync(join(expected, "smt.json"), "utf-8"));

    const quintRun = fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, quintEnv);
    expect(quintRun.status).toBe(0);
    expect(JSON.parse(quintRun.stdout)).toMatchObject({ pass: false, findings_count: 2, method: "simulation" });
    expect(readFileSync(join(verifyDir, "quint.json"), "utf-8")).toBe(readFileSync(join(expected, "quint.json"), "utf-8"));
    expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8")).toBe(readFileSync(join(expected, "cross-check.json"), "utf-8"));

    const before = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    expect(fire("aidlc-sensor-deep-spec-design-verify-quint.ts", modelPath, quintEnv).status).toBe(0);
    const after = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(after).toEqual(before);
    rmSync(makeRecord().record, { recursive: true, force: true });
  }, 240_000);

  test("the planted refinement defects surface with requirements-side targets and provenance", () => {
    const smt = JSON.parse(readFileSync(join(expected, "smt.json"), "utf-8"));
    const byKind = (k: string): { targets: string[]; frRefs: string[] }[] => smt.findings.filter((f: { kind: string }) => f.kind === k);
    const rv = byKind("refinement-violation");
    expect(rv.map((f) => f.targets.join(","))).toEqual(["OB-1", "SC-2"]);
    expect(rv[0]?.frRefs).toEqual(["FR-1"]);
    expect(byKind("mapping-gap")[0]?.targets).toEqual(["attr:order.note"]);
    // Enabledness: the requirements event's gap names both the requirement and
    // its mapped transition.
    const enable = smt.findings.find((f: { kind: string; targets: string[] }) => f.kind === "completeness-gap" && f.targets.includes("OB-2"));
    expect(enable?.targets).toEqual(["OB-2", "TR-2"]);
    expect(smt.skipped).toEqual([{ target: "OB-3", reason: "waived", unit: "u1-orders", detail: "depends on the unmapped audit flag" }]);
    expect((smt.inputs ?? []).map((i: { artifact: string }) => i.artifact)).toHaveLength(3);

    const quint = JSON.parse(readFileSync(join(expected, "quint.json"), "utf-8"));
    const reachable = quint.findings.find((f: { kind: string }) => f.kind === "refinement-violation");
    expect(reachable?.targets).toEqual(["OB-1"]);
    expect(Array.isArray(reachable?.witness?.trace)).toBe(true);
    const lastState = reachable?.witness?.trace?.at(-1) ?? {};
    expect(lastState["ticket.phase"]).toBe("closed");
    expect(lastState["ticket.value"]).toBe(0);
  });
});

describe("refinement degradation (never silence)", () => {
  test("an absent refinement map skips every requirements target with absent-input", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available");
      return;
    }
    const { modelPath, mapPath, verifyDir } = makeRecord();
    rmSync(mapPath, { force: true });
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    const refSkips = doc.skipped.filter((s: { reason: string }) => s.reason === "absent-input");
    expect(refSkips.map((s: { target: string }) => s.target).sort()).toEqual(["OB-1", "OB-2", "OB-3", "SC-1", "SC-2"]);
    expect(doc.findings.some((f: { kind: string }) => f.kind === "refinement-violation")).toBe(false);
  }, 120_000);

  test("a stale map hash skips every requirements target with stale-input", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available");
      return;
    }
    const { modelPath, mapPath, verifyDir } = makeRecord();
    writeFileSync(mapPath, readFileSync(mapPath, "utf-8").replace(/"designIrHash": "[0-9a-f]{64}"/, `"designIrHash": "${"0".repeat(64)}"`));
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    const refSkips = doc.skipped.filter((s: { reason: string }) => s.reason === "stale-input");
    expect(refSkips.length).toBe(5);
    expect(refSkips[0].detail).toContain("designIrHash");
  }, 120_000);

  test("a map without this unit's entry skips with absent-input naming the unit", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available");
      return;
    }
    const { modelPath, mapPath, verifyDir } = makeRecord();
    writeFileSync(mapPath, readFileSync(mapPath, "utf-8").replace('"unit": "u1-orders"', '"unit": "u2-other"'));
    expect(fire("aidlc-sensor-deep-spec-design-verify-smt.ts", modelPath).status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    const refSkips = doc.skipped.filter((s: { detail?: string }) => (s.detail ?? "").includes("no entry for unit u1-orders"));
    expect(refSkips.length).toBe(5);
  }, 120_000);
});
