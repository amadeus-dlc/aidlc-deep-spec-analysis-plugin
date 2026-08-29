// Conformance suite for the deep-spec-analysis verification backends
// (FR12.1 / FR12.2 / NFR1 / NFR3 / FR8).
//
// The canonical IR fixture intentionally contains a static rule pair that
// annihilates its shared condition, a same-trigger event pair with
// contradictory effects, an uncovered input region, an invariant the event
// machine fails to preserve, and a broken accept example. Both backends must
// reproduce the expected contract-2 findings BYTE-FOR-BYTE, twice
// (determinism), degrade cleanly when a solver is absent, and surface a
// cross-check disagreement when the backends genuinely diverge.
//
// Solver pinning: z3-solver and @informalsystems/quint are exact-pinned
// devDependencies of this repository, so the expected files are stable.
// The quint backend is forced to `simulation` (fixed seed) — bounded mode
// depends on a JVM+Apalache environment.

import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
const fixtures = join(pluginRoot, "tests", "fixtures");
const expected = join(fixtures, "conformance", "expected");
const quintBin = join(pluginRoot, "node_modules", ".bin", "quint");

const nodeAvailable = ((): boolean => {
  const res = spawnSync("node", ["--version"], { encoding: "utf-8", timeout: 10_000 });
  return !res.error && res.status === 0;
})();

interface SensorRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function fireSensor(tool: string, modelPath: string, env: { [k: string]: string } = {}): SensorRun {
  const res = spawnSync("bun", [join(toolsDir, tool), "--stage", "deep-spec-analysis-verify", "--output-path", modelPath], {
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env, ...env },
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function makeRecord(modelFixture: string): { record: string; modelPath: string; verifyDir: string } {
  const record = join(tmpdir(), `deep-spec-conformance-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
  mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
  cpSync(join(fixtures, "conformance", "requirements.md"), join(record, "inception", "requirements-analysis", "requirements.md"));
  const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
  cpSync(modelFixture, modelPath);
  return { record, modelPath, verifyDir: join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify") };
}

const quintEnv = {
  AIDLC_DEEP_SPEC_QUINT_METHOD: "simulation",
  AIDLC_DEEP_SPEC_QUINT_BIN: quintBin,
};

describe("deep-spec-ir-valid", () => {
  test("passes the canonical fixture", () => {
    const { modelPath } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const run = fireSensor("aidlc-sensor-deep-spec-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("rejects the broken fixture with each designed defect", () => {
    const { modelPath } = makeRecord(join(fixtures, "invalid", "deep-spec-analysis-formal-model.md"));
    const run = fireSensor("aidlc-sensor-deep-spec-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout);
    expect(verdict.pass).toBe(false);
    const all = verdict.errors.join("\n");
    expect(all).toContain('unresolvable reference "order.total"');
    expect(all).toContain("primed reference");
    expect(all).toContain('enum literal "cancelled"');
    expect(all).toContain('frRef "FR-99"');
  });

  test("rejects a drifted requirements source via sourceDigest", () => {
    const { record, modelPath } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const req = join(record, "inception", "requirements-analysis", "requirements.md");
    writeFileSync(req, `${readFileSync(req, "utf-8")}\n- FR-9: 監査ログを5年間保持しなければならない。\n`);
    const run = fireSensor("aidlc-sensor-deep-spec-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout);
    expect(verdict.pass).toBe(false);
    expect(verdict.errors.join("\n")).toMatch(/sourceDigest [0-9a-f]{64} does not match requirements\.md \(sha256 [0-9a-f]{64}\)/);
  });

  test("rejects a model without sourceDigest and hands back the value to add", () => {
    const { modelPath } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const stripped = readFileSync(modelPath, "utf-8").replace(/^\s*"sourceDigest": "[0-9a-f]{64}",\n/m, "");
    expect(stripped).not.toContain("sourceDigest");
    writeFileSync(modelPath, stripped);
    const run = fireSensor("aidlc-sensor-deep-spec-ir-valid.ts", modelPath);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout);
    expect(verdict.pass).toBe(false);
    expect(verdict.errors.join("\n")).toMatch(/add "sourceDigest": "[0-9a-f]{64}"/);
  });

  test("passes through writes that are not the formal model", () => {
    const { record } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const other = join(record, "inception", "deep-spec-analysis-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    const run = fireSensor("aidlc-sensor-deep-spec-ir-valid.ts", other);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, note: "not-applicable" });
  });
});

describe("backend conformance (expected findings, byte-for-byte)", () => {
  const canonical = join(fixtures, "conformance", "deep-spec-analysis-formal-model.md");
  let modelPath = "";
  let verifyDir = "";

  beforeAll(() => {
    ({ modelPath, verifyDir } = makeRecord(canonical));
  });

  test("smt backend reproduces expected smt.json", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available — smt child cannot run");
      return;
    }
    const run = fireSensor("aidlc-sensor-deep-spec-verify-smt.ts", modelPath);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 4, method: "exhaustive" });
    expect(readFileSync(join(verifyDir, "smt.json"), "utf-8")).toBe(readFileSync(join(expected, "smt.json"), "utf-8"));
  });

  test("quint backend (simulation) reproduces expected quint.json", () => {
    const run = fireSensor("aidlc-sensor-deep-spec-verify-quint.ts", modelPath, quintEnv);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: false, findings_count: 2, method: "simulation" });
    expect(readFileSync(join(verifyDir, "quint.json"), "utf-8")).toBe(readFileSync(join(expected, "quint.json"), "utf-8"));
  });

  test("cross-check converges with the expected comparison surface and no disagreement", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available — cross-check needs both backends");
      return;
    }
    expect(readFileSync(join(verifyDir, "cross-check.json"), "utf-8")).toBe(
      readFileSync(join(expected, "cross-check.json"), "utf-8"),
    );
  });

  test("second run of every backend is byte-identical (NFR1 determinism)", () => {
    if (!nodeAvailable) {
      console.warn("SKIP: node runtime not available");
      return;
    }
    const before = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(fireSensor("aidlc-sensor-deep-spec-verify-smt.ts", modelPath).status).toBe(0);
    expect(fireSensor("aidlc-sensor-deep-spec-verify-quint.ts", modelPath, quintEnv).status).toBe(0);
    const after = ["smt.json", "quint.json", "cross-check.json"].map((f) => readFileSync(join(verifyDir, f), "utf-8"));
    expect(after).toEqual(before);
  });
});

describe("cross-check disagreement (FR8.2)", () => {
  test("a genuinely diverging sibling produces a cross-check-disagreement finding", () => {
    const { modelPath, verifyDir } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    // Forge an "smt" findings file that claims SC-2 is clean (same irHash so
    // it participates in the comparison), then run the quint backend, which
    // recomputes cross-check.json from all sibling files.
    const forged = JSON.parse(readFileSync(join(expected, "smt.json"), "utf-8"));
    forged.findings = forged.findings.filter((f: { kind: string }) => f.kind !== "scenario-violation");
    mkdirSync(verifyDir, { recursive: true });
    writeFileSync(join(verifyDir, "smt.json"), `${JSON.stringify(forged, null, 2)}\n`);
    const run = fireSensor("aidlc-sensor-deep-spec-verify-quint.ts", modelPath, quintEnv);
    expect(run.status).toBe(0);
    const cross = JSON.parse(readFileSync(join(verifyDir, "cross-check.json"), "utf-8"));
    expect(cross.findings.length).toBe(1);
    expect(cross.findings[0]).toMatchObject({
      kind: "cross-check-disagreement",
      targets: ["SC-2"],
      witness: { verdicts: { quint: "violated", smt: "clean" } },
    });
  });
});

describe("degradation (NFR3 — no failure blocks the stage)", () => {
  test("quint backend degrades to `unavailable` when the CLI is missing", () => {
    const { modelPath, verifyDir } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const run = fireSensor("aidlc-sensor-deep-spec-verify-quint.ts", modelPath, {
      AIDLC_DEEP_SPEC_QUINT_BIN: "/nonexistent/quint",
    });
    expect(run.status).toBe(127);
    const doc = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    expect(doc.unavailable.reason).toContain("quint CLI");
    expect(doc.skipped.length).toBe(12);
    expect(doc.skipped.every((s: { reason: string }) => s.reason === "unavailable")).toBe(true);
  });

  test("smt backend degrades to `unavailable` when no runtime can execute z3", () => {
    const { modelPath, verifyDir } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const run = fireSensor("aidlc-sensor-deep-spec-verify-smt.ts", modelPath, {
      AIDLC_DEEP_SPEC_SMT_RUNTIME: "/nonexistent/runtime",
    });
    expect(run.status).toBe(127);
    const doc = JSON.parse(readFileSync(join(verifyDir, "smt.json"), "utf-8"));
    expect(doc.unavailable.reason).toContain("no runtime");
    expect(doc.skipped.length).toBeGreaterThan(0);
  });

  test("an ir-version-mismatch skips every target with the reason", () => {
    const { modelPath, verifyDir } = makeRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const bumped = readFileSync(modelPath, "utf-8").replace('"irVersion": "1.0.0"', '"irVersion": "2.0.0"');
    writeFileSync(modelPath, bumped);
    const run = fireSensor("aidlc-sensor-deep-spec-verify-quint.ts", modelPath, quintEnv);
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(verifyDir, "quint.json"), "utf-8"));
    expect(doc.findings.length).toBe(0);
    expect(doc.skipped.length).toBe(12);
    expect(doc.skipped.every((s: { reason: string }) => s.reason === "ir-version-mismatch")).toBe(true);
  });
});
