import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash } from "@deep-spec-analysis/kernel-domain";
import { parseFormalModel, QuintClientImplementation } from "@deep-spec-analysis/requirements-adapter";
import {
  FormalModelIdentifier,
  RequirementsModel,
  VerificationReportIdentifier,
} from "@deep-spec-analysis/requirements-domain";

function model(): RequirementsModel {
  const parsed = parseFormalModel({
    irVersion: "1.0.0",
    schema: { entities: [{ name: "Account", attributes: [{ name: "active", type: { kind: "bool" } }] }] },
    obligations: [
      { id: "OB-1", nature: "invariant", frRefs: [], assert: { op: "ref", path: "Account.active" } },
      {
        id: "OB-2",
        nature: "state-temporal",
        frRefs: [],
        temporal: { pattern: "leads-to", from: { op: "bool", value: true }, to: { op: "ref", path: "Account.active" } },
      },
    ],
    scenarios: [{ id: "SC-1", kind: "accept", frRefs: [], bindings: { "Account.active": true } }],
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

function fakeQuint(directory: string, name: string, exitCode: number): string {
  const path = join(directory, name);
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      'if (process.argv.includes("--version")) { console.log("0.32.0"); process.exit(0); }',
      'console.log("The outcome is: NoError");',
      'console.log("[ok] No violation found");',
      'console.error("warning: ...throw an error instead... error_on_unsafe_pre22_gencode ...");',
      `process.exit(${exitCode});`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return path;
}

function signalQuint(directory: string, name: string, signal: "SIGTERM" | "SIGKILL"): string {
  const path = join(directory, name);
  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      'if (process.argv.includes("--version")) { console.log("0.32.0"); process.exit(0); }',
      `process.kill(process.pid, "${signal}");`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return path;
}

test("normal exit with NoError and warning logs is clean across machine, temporal, and scenario phases", () => {
  const directory = mkdtempSync(join(tmpdir(), "quint-process-outcome-success-"));
  try {
    const input = model();
    const result = new QuintClientImplementation({
      quintBin: fakeQuint(directory, "quint-success.mjs", 0),
      methodOverride: "bounded",
      apalacheDistSet: false,
      homeDirectory: "",
    }).check(input);

    expect(result.match({ checked: () => true, unavailable: () => false, uncompilable: () => false })).toBe(true);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
    expect(report.skipped().toArray()).toEqual([]);
    expect([...report.findings()]).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a nonzero exit remains a run failure even with normal-looking logs", () => {
  const directory = mkdtempSync(join(tmpdir(), "quint-process-outcome-failure-"));
  try {
    const input = model();
    const result = new QuintClientImplementation({
      quintBin: fakeQuint(directory, "quint-failure.mjs", 7),
      methodOverride: "bounded",
      apalacheDistSet: false,
      homeDirectory: "",
    }).check(input);

    expect(result.match({ checked: () => true, unavailable: () => false, uncompilable: () => false })).toBe(true);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
    expect(report.skipped().count()).toBeGreaterThan(0);
    expect(
      report
        .skipped()
        .toArray()
        .every((skip) => skip.reason() === "unavailable"),
    ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each(["SIGTERM", "SIGKILL"] as const)("a child %s is a run failure, not a timeout", (signal) => {
  const directory = mkdtempSync(join(tmpdir(), `quint-process-outcome-${signal.toLowerCase()}-`));
  try {
    const input = model();
    const result = new QuintClientImplementation({
      quintBin: signalQuint(directory, `quint-${signal.toLowerCase()}.mjs`, signal),
      methodOverride: "bounded",
      apalacheDistSet: false,
      homeDirectory: "",
    }).check(input);

    expect(result.match({ checked: () => true, unavailable: () => false, uncompilable: () => false })).toBe(true);
    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
    expect(report.skipped().count()).toBeGreaterThan(0);
    expect(
      report
        .skipped()
        .toArray()
        .every((skip) => skip.reason() === "unavailable"),
    ).toBe(true);
    expect(
      report
        .skipped()
        .toArray()
        .some((skip) => skip.reason() === "timeout"),
    ).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a quiet machine success does not hide a temporal nonzero failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "quint-process-outcome-temporal-failure-"));
  try {
    const path = join(directory, "quint-temporal-failure.mjs");
    writeFileSync(
      path,
      [
        "#!/usr/bin/env node",
        'if (process.argv.includes("--version")) { console.log("0.32.0"); process.exit(0); }',
        'if (process.argv.some((arg) => arg.startsWith("--temporal="))) process.exit(7);',
        'console.log("The outcome is: NoError");',
        'console.log("[ok] No violation found");',
        "process.exit(0);",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const input = model();
    const result = new QuintClientImplementation({
      quintBin: path,
      methodOverride: "bounded",
      apalacheDistSet: false,
      homeDirectory: "",
    }).check(input);

    const report = result.reportFor(input, VerificationReportIdentifier.of(ArtifactPath.of("/verify"), "quint"));
    expect(
      report
        .skipped()
        .toArray()
        .map((skip) => `${skip.target().asString()}:${skip.reason()}`),
    ).toEqual(["OB-2:unavailable"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
