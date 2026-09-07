import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";
import {
  hasQuintDeadlockDiagnostic,
  parseFormalModel,
  QuintClientImplementation,
} from "@deep-spec-analysis/requirements-adapter";
import {
  FormalModelIdentifier,
  RequirementsModel,
  VerificationReportIdentifier,
} from "@deep-spec-analysis/requirements-domain";

function model(): RequirementsModel {
  const parsed = parseFormalModel({
    irVersion: "1.0.0",
    schema: { entities: [{ name: "Account", attributes: [{ name: "active", type: { kind: "bool" } }] }] },
    obligations: [{ id: "OB-1", nature: "invariant", frRefs: [], assert: { op: "ref", path: "Account.active" } }],
    scenarios: [],
    background: [],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return RequirementsModel.of({
    ...parsed.value,
    id: FormalModelIdentifier.of(ArtifactPath.of("/model")),
    irHash: ContentHash.ofText("model"),
    sourceDocument: new Uint8Array(),
  });
}

function fakeQuint(
  directory: string,
  stderrLine: string | null,
  stdoutLine: string | null,
  makeItfDirectory = false,
): string {
  const path = join(directory, "quint.mjs");
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      'import { mkdirSync } from "node:fs";',
      'if (process.argv.includes("--version")) { console.log("0.32.0"); process.exit(0); }',
      `const output = process.argv.find((arg) => arg.startsWith("--out-itf="));${makeItfDirectory ? 'if (output) mkdirSync(output.slice("--out-itf=".length), { recursive: true });' : ""}`,
      stdoutLine === null ? "" : `console.log(${JSON.stringify(stdoutLine)});`,
      stderrLine === null ? "" : `console.error(${JSON.stringify(stderrLine)});`,
      "process.exit(1);",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return path;
}

function checkWith(quintBin: string) {
  const input = model();
  const result = new QuintClientImplementation({
    quintBin,
    methodOverride: "simulation",
    apalacheDistSet: false,
    homeDirectory: "",
  }).check(input);
  return result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
}

test("deadlock diagnostic requires an exact stderr line", () => {
  expect(hasQuintDeadlockDiagnostic("warning\nerror: reached a deadlock\n")).toBe(true);
  expect(hasQuintDeadlockDiagnostic("deadlock is a variable\n")).toBe(false);
  expect(hasQuintDeadlockDiagnostic("error: not reached a deadlock\n")).toBe(false);
  expect(hasQuintDeadlockDiagnostic("error: reached a deadlock while checking\n")).toBe(false);
});

test.each([
  ["exact diagnostic", "error: reached a deadlock", null, "completeness-gap"],
  ["stdout data name", null, "deadlock is a variable name", "unavailable"],
  ["negative stderr text", "warning: not an error: reached a deadlock", null, "unavailable"],
] as const)("machine process outcome: %s", (_name, stderrLine, stdoutLine, expected) => {
  const directory = mkdtempSync(join(tmpdir(), "quint-deadlock-diagnostic-"));
  try {
    const report = checkWith(fakeQuint(directory, stderrLine, stdoutLine));
    expect(
      report
        .findings()
        .toArray()
        .map((finding) => finding.kind()),
    ).toEqual(expected === "completeness-gap" ? ["completeness-gap"] : []);
    if (expected === "unavailable")
      expect(
        report
          .skipped()
          .toArray()
          .some((skip) => skip.reason() === "unavailable"),
      ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ITF read failures become run-failed while a missing ITF remains normal", () => {
  const directory = mkdtempSync(join(tmpdir(), "quint-itf-read-failure-"));
  try {
    const report = checkWith(fakeQuint(directory, null, null, true));
    expect(report.findings().toArray()).toEqual([]);
    expect(
      report
        .skipped()
        .toArray()
        .some((skip) => skip.detail()?.includes("quint ITF read failed: io-failed")),
    ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
