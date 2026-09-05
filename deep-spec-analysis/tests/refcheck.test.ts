// Conformance suite for the phase-1 deep-spec-refcheck sensors
// (design-verification extension: FR2–FR5, FR15.2) and for the contract-2
// self-validation obligation (FR1.2/FR1.3).
//
// The broken fixture record plants at least one defect per check family
// (DD-1..DD-7, FD-E*, FD-R*, FD-S*, CD-*, XS-*); the clean record exercises
// the same catalog and must come back with zero findings and every family
// listed in checked[]. Both are golden-file tests: byte-for-byte, twice
// (NFR1 determinism). Degradation: unparseable YAML and absent sibling
// artifacts close into findings/skipped — never a crash, never silence.
// Finally, EVERY golden findings file in the repository (v1 conformance
// goldens included) must validate against deep-spec-findings-schema.json —
// the regression guard that keeps writers and contract in agreement.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "@deep-spec/kernel-infrastructure";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
// スキーマ原本はソースツリー側（src/entries/data/）。toolsDir は生成される配布物の
// spawn 先で、原本の置き場ではない。
const dataDir = join(pluginRoot, "src", "entries", "data");
const fixtures = join(pluginRoot, "tests", "fixtures", "refcheck");
const expected = join(fixtures, "expected");

const TOOLS = {
  domain: "aidlc-sensor-deep-spec-refcheck-domain.ts",
  contract: "aidlc-sensor-deep-spec-refcheck-contract.ts",
  functional: "aidlc-sensor-deep-spec-refcheck-functional.ts",
};

interface SensorRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function fire(tool: string, outputPath: string, extraArgs: string[] = []): SensorRun {
  const res = spawnSync(
    "bun",
    [join(toolsDir, tool), "--stage", "refcheck-test", "--output-path", outputPath, ...extraArgs],
    {
      encoding: "utf-8",
      timeout: 60_000,
    },
  );
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function makeRecord(fixture: "broken" | "clean"): string {
  const record = join(tmpdir(), `deep-spec-refcheck-${Math.random().toString(36).slice(2)}`);
  cpSync(join(fixtures, fixture), record, { recursive: true });
  return record;
}

const PATHS = {
  domain: ["inception", "domain-design", "components.md"],
  contract: ["inception", "contract-design", "contract-summary.md"],
  functional: ["construction", "u1-orders", "functional-design", "entities.md"],
};

const OUT = {
  domain: ["inception", "domain-design", "deep-spec-refcheck", "components.json"],
  contract: ["inception", "contract-design", "deep-spec-refcheck", "contract-summary.json"],
  functional: ["construction", "u1-orders", "functional-design", "deep-spec-refcheck", "functional-design.json"],
};

describe("refcheck golden findings (byte-for-byte)", () => {
  for (const fixture of ["broken", "clean"] as const) {
    for (const kind of ["domain", "contract", "functional"] as const) {
      test(`${kind} sensor reproduces expected ${fixture} findings`, () => {
        const record = makeRecord(fixture);
        const run = fire(TOOLS[kind], join(record, ...PATHS[kind]));
        expect(run.status).toBe(0);
        const verdict = JSON.parse(run.stdout) as { pass: boolean; method: string };
        expect(verdict.method).toBe("static");
        expect(verdict.pass).toBe(fixture === "clean");
        expect(readFileSync(join(record, ...OUT[kind]), "utf-8")).toBe(
          readFileSync(join(expected, fixture, OUT[kind][OUT[kind].length - 1] as string), "utf-8"),
        );
        rmSync(record, { recursive: true, force: true });
      });
    }
  }

  test("second run of every sensor is byte-identical (NFR1 determinism)", () => {
    const record = makeRecord("broken");
    for (const kind of ["domain", "contract", "functional"] as const) {
      expect(fire(TOOLS[kind], join(record, ...PATHS[kind])).status).toBe(0);
    }
    const before = (["domain", "contract", "functional"] as const).map((k) =>
      readFileSync(join(record, ...OUT[k]), "utf-8"),
    );
    for (const kind of ["domain", "contract", "functional"] as const) {
      expect(fire(TOOLS[kind], join(record, ...PATHS[kind])).status).toBe(0);
    }
    const after = (["domain", "contract", "functional"] as const).map((k) =>
      readFileSync(join(record, ...OUT[k]), "utf-8"),
    );
    expect(after).toEqual(before);
    rmSync(record, { recursive: true, force: true });
  });

  test("the clean goldens list every check family as checked (no-silence)", () => {
    const checkedOf = (file: string): string[] =>
      (JSON.parse(readFileSync(join(expected, "clean", file), "utf-8")) as { checked: string[] }).checked;
    expect(checkedOf("components.json")).toEqual(
      ["DD-0", "DD-1", "DD-2", "DD-3", "DD-4", "DD-5", "DD-6", "DD-7"].map((f) => `check:${f}`),
    );
    expect(checkedOf("contract-summary.json")).toEqual(["CD-1", "CD-2", "CD-3"].map((f) => `check:${f}`));
    expect(checkedOf("functional-design.json")).toEqual(
      [
        "FD-E1",
        "FD-E2",
        "FD-E3",
        "FD-E4",
        "FD-E5",
        "FD-E6",
        "FD-R1",
        "FD-R2",
        "FD-R3",
        "FD-R4",
        "FD-R5",
        "FD-S1",
        "FD-S2",
        "XS-1",
        "XS-2",
        "XS-3",
      ].map((f) => `check:${f}`),
    );
  });
});

describe("refcheck degradation (never a crash, never silence)", () => {
  test("an out-of-subset yaml block becomes a parse finding plus family skips", () => {
    const record = makeRecord("clean");
    const entities = join(record, ...PATHS.functional);
    writeFileSync(entities, "# Entities\n\n```yaml\nentities: &anchor\n  - name: Order\n```\n");
    const run = fire(TOOLS.functional, entities);
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(record, ...OUT.functional), "utf-8"));
    const e1 = doc.findings.find((f: { detail: string }) => f.detail.startsWith("FD-E1"));
    expect(e1.kind).toBe("structure-invalid");
    expect(e1.detail).toContain("unsupported YAML feature");
    for (const family of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
      expect(
        doc.skipped.some(
          (s: { target: string; reason: string }) =>
            s.target === `check:${family}` && s.reason === "unrecognized-format",
        ),
      ).toBe(true);
    }
    rmSync(record, { recursive: true, force: true });
  });

  test("an absent components.md skips the XS families with absent-input", () => {
    const record = makeRecord("clean");
    rmSync(join(record, "inception", "domain-design"), { recursive: true, force: true });
    const run = fire(TOOLS.functional, join(record, ...PATHS.functional));
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(record, ...OUT.functional), "utf-8"));
    for (const family of ["XS-1", "XS-2", "XS-3"]) {
      expect(
        doc.skipped.some(
          (s: { target: string; reason: string }) => s.target === `check:${family}` && s.reason === "absent-input",
        ),
      ).toBe(true);
    }
    rmSync(record, { recursive: true, force: true });
  });

  test("an absent units edge block skips the unit-dependent contract families", () => {
    const record = makeRecord("clean");
    rmSync(join(record, "inception", "units-generation"), { recursive: true, force: true });
    const run = fire(TOOLS.contract, join(record, ...PATHS.contract));
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(record, ...OUT.contract), "utf-8"));
    for (const family of ["CD-1", "CD-3"]) {
      expect(
        doc.skipped.some(
          (s: { target: string; reason: string }) => s.target === `check:${family}` && s.reason === "absent-input",
        ),
      ).toBe(true);
    }
    expect(doc.checked).toContain("check:CD-2");
    rmSync(record, { recursive: true, force: true });
  });

  test("--report-only computes the verdict without writing anything", () => {
    const record = makeRecord("broken");
    const run = fire(TOOLS.domain, join(record, ...PATHS.domain), ["--report-only"]);
    expect(run.status).toBe(0);
    const verdict = JSON.parse(run.stdout) as { pass: boolean; note?: string; findings_count: number };
    expect(verdict.pass).toBe(false);
    expect(verdict.findings_count).toBeGreaterThan(0);
    expect(verdict.note).toBe("report-only");
    expect(existsSync(join(record, "inception", "domain-design", "deep-spec-refcheck"))).toBe(false);
    rmSync(record, { recursive: true, force: true });
  });

  test("free-text unit names sanitize into valid target ids instead of degrading the document", () => {
    // A table cell like "Order Service" must not produce a schema-invalid
    // target id — that would trip self-validation and degrade the WHOLE
    // document to `unavailable`, erasing every finding exactly when the
    // sensor is most valuable. The token is sanitized; the raw string
    // survives in the witness.
    const doc = JSON.parse(readFileSync(join(expected, "broken", "contract-summary.json"), "utf-8"));
    expect(doc.unavailable).toBeUndefined();
    const f = doc.findings.find((x: { detail: string }) => x.detail.includes("Order Service"));
    expect(f.targets).toContain("unit:Order-Service");
    expect(f.witness.refs.some((r: { value?: string }) => r.value === "Order Service")).toBe(true);
  });

  test("rules using the `sources` synonym do not trip the required-key check", () => {
    const record = makeRecord("clean");
    const rules = join(record, "construction", "u1-orders", "functional-design", "rules.md");
    writeFileSync(rules, readFileSync(rules, "utf-8").replace("    source: FR-2", "    sources: [FR-2]"));
    const run = fire(TOOLS.functional, join(record, ...PATHS.functional));
    expect(run.status).toBe(0);
    const doc = JSON.parse(readFileSync(join(record, ...OUT.functional), "utf-8"));
    expect(doc.findings.filter((f: { detail: string }) => f.detail.startsWith("FD-R1"))).toEqual([]);
    expect(doc.checked).toContain("check:FD-R1");
    rmSync(record, { recursive: true, force: true });
  });

  test("writes that are not the sensor's artifact pass through", () => {
    const record = makeRecord("clean");
    const other = join(record, "inception", "domain-design", "notes.md");
    writeFileSync(other, "# notes\n");
    const run = fire(TOOLS.domain, other);
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ pass: true, note: "not-applicable" });
    rmSync(record, { recursive: true, force: true });
  });
});

describe("contract-2 schema conformance of every golden findings file (FR1.3)", () => {
  const schemaDoc = JSON.parse(readFileSync(join(dataDir, "deep-spec-findings-schema.json"), "utf-8"));
  const goldenDirs = [
    join(pluginRoot, "tests", "fixtures", "conformance", "expected"),
    join(expected, "broken"),
    join(expected, "clean"),
  ];
  for (const dir of goldenDirs) {
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      test(`${dir.split("/").slice(-2).join("/")}/${file} conforms to deep-spec-findings-schema.json`, () => {
        const doc = JSON.parse(readFileSync(join(dir, file), "utf-8"));
        const errors: string[] = [];
        validateSchema(schemaDoc, schemaDoc, doc, "", errors);
        expect(errors).toEqual([]);
      });
    }
  }
});
