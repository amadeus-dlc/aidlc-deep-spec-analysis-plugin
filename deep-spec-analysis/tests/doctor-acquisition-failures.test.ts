import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DoctorPresenter,
  DoctorWorkspaceClientImplementation,
  InstallationProvenanceClientImplementation,
  ReferenceCheckBackendClientImplementation,
  SolverProbeClientImplementation,
} from "@deep-spec-analysis/doctor-adapter";
import {
  DesignArtifactReference,
  FindingCount,
  IntentLocation,
  StructuralDebt,
  StructuralObservation,
} from "@deep-spec-analysis/doctor-domain";
import { ArtifactPath, ContentHash, ErrorMessage } from "@deep-spec-analysis/kernel-domain";
import { canonicalStringify, ok } from "@deep-spec-analysis/kernel-infrastructure";
import { requireSuccess } from "./result-fixtures.ts";

const directories: string[] = [];
afterAll(() => {
  for (const path of directories) rmSync(path, { recursive: true, force: true });
});

function workspace() {
  const project = mkdtempSync(join(tmpdir(), "doctor-acquisition-failure-"));
  directories.push(project);
  const harness = join(project, ".claude");
  return {
    project,
    harness,
    client: new DoctorWorkspaceClientImplementation({
      projectDir: project,
      root: harness,
      refcheckToolNames: { domain: "domain.ts", contract: "contract.ts", functional: "functional.ts" },
    }),
  };
}
const presenter = new DoctorPresenter({ harnessDir: ".claude" });

function recordIn(project: string): string {
  const record = join(project, "aidlc/spaces/default/intents/intent");
  mkdirSync(record, { recursive: true });
  writeFileSync(join(record, "aidlc-state.md"), "- **Scope**: feature\n");
  return record;
}

test("a nonexistent workspace is empty, but a failed workspace listing is not a healthy zero", () => {
  const { project, client } = workspace();
  expect(requireSuccess(client.verificationCoverage()).eligibleCount()).toBe(0);
  mkdirSync(join(project, "aidlc"));
  writeFileSync(join(project, "aidlc/spaces"), "not a directory");
  const verification = client.verificationCoverage();
  const functional = client.functionalCoverage();
  const artifacts = client.designArtifacts();
  for (const result of [verification, functional, artifacts]) {
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("io-failed");
  }
  for (const rows of [presenter.verificationCoverage(verification), presenter.functionalCoverage(functional)]) {
    expect(rows).toHaveLength(1);
    expect(rows[0]?.passes()).toBe(false);
    expect(rows[0]?.label()).toContain("io-failed");
    expect(rows[0]?.label()).not.toContain("0/0");
  }
});

test("unreadable intent state and construction directories cannot silently leave the scan", () => {
  const { project, client } = workspace();
  const record = recordIn(project);
  rmSync(join(record, "aidlc-state.md"));
  mkdirSync(join(record, "aidlc-state.md"));
  expect(client.verificationCoverage().ok).toBe(false);
  expect(client.functionalCoverage().ok).toBe(false);
  rmSync(join(record, "aidlc-state.md"), { recursive: true });
  writeFileSync(join(record, "aidlc-state.md"), "- **Scope**: feature\n");
  writeFileSync(join(record, "construction"), "not a directory");
  expect(client.functionalCoverage().ok).toBe(false);
  expect(client.designArtifacts().ok).toBe(false);
});

test("coverage requires a readable matching backend report, not any JSON filename", () => {
  const { project, client } = workspace();
  const record = recordIn(project);
  const source = "# 要件\n";
  const model = {
    irVersion: "1.0.0",
    sourceDigest: ContentHash.ofText(source).asString(),
    schema: { entities: [] },
    obligations: [],
    scenarios: [],
    background: [],
  };
  const modelPath = join(record, "inception/deep-spec-analysis-verify/deep-spec-analysis-formal-model.md");
  const directory = join(record, "inception/deep-spec-analysis-verify/deep-spec-verify");
  mkdirSync(join(record, "inception/requirements-analysis"), { recursive: true });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(record, "inception/requirements-analysis/requirements.md"), source);
  writeFileSync(modelPath, `\`\`\`json\n${JSON.stringify(model)}\n\`\`\`\n`);
  writeFileSync(join(directory, "random.json"), "not JSON");
  expect(requireSuccess(client.verificationCoverage()).verifiedCount()).toBe(0);
  writeFileSync(join(directory, "smt.json"), "not JSON");
  const broken = client.verificationCoverage();
  expect(broken.ok).toBe(false);
  if (!broken.ok) expect(broken.error.kind).toBe("corrupt");
  const report = {
    backend: "smt",
    irVersion: "1.0.0",
    irHash: ContentHash.ofText(canonicalStringify(model)).asString(),
    method: "exhaustive",
    findings: [],
    skipped: [],
  };
  writeFileSync(join(directory, "smt.json"), JSON.stringify(report));
  expect(requireSuccess(client.verificationCoverage()).verifiedCount()).toBe(1);
  writeFileSync(
    join(directory, "smt.json"),
    JSON.stringify({ ...report, unavailable: { reason: "solver not installed" } }),
  );
  expect(requireSuccess(client.verificationCoverage()).verifiedCount()).toBe(0);
  writeFileSync(
    join(directory, "smt.json"),
    JSON.stringify({ ...report, irHash: ContentHash.ofText("different model").asString() }),
  );
  expect(requireSuccess(client.verificationCoverage()).verifiedCount()).toBe(0);
});

test("a functional-design document replaced by a directory is an acquisition failure", () => {
  const { project, client } = workspace();
  const record = recordIn(project);
  mkdirSync(join(record, "construction/u1/functional-design/entities.md"), { recursive: true });
  const result = client.functionalCoverage();
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("corrupt");
});

test("missing, partial and not-applicable refcheck results remain visible in doctor output", () => {
  const { project, harness } = workspace();
  const artifact = DesignArtifactReference.of({
    location: IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of("intent")),
    tool: ArtifactPath.of("probe.ts"),
    artifactPath: ArtifactPath.of(join(project, "components.md")),
    relativePath: ArtifactPath.of("components.md"),
  });
  const backend = new ReferenceCheckBackendClientImplementation({ root: harness });
  let debt = StructuralDebt.of([backend.observe(artifact)]);
  expect(debt.isComplete()).toBe(false);
  expect(presenter.structuralDebt(ok(debt))).toHaveLength(1);
  expect(presenter.structuralDebt(ok(debt))[0]?.passes()).toBe(false);
  mkdirSync(join(harness, "tools"), { recursive: true });
  for (const response of [
    { pass: true, findings_count: 0, skipped_count: 1 },
    { pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" },
    { pass: false, findings_count: 0, skipped_count: 0 },
  ]) {
    writeFileSync(
      join(harness, "tools/probe.ts"),
      `process.stdout.write(${JSON.stringify(`${JSON.stringify(response)}\n`)});`,
    );
    debt = StructuralDebt.of([backend.observe(artifact)]);
    expect(debt.isComplete()).toBe(false);
    expect(presenter.structuralDebt(ok(debt)).every((row) => !row.passes())).toBe(true);
    expect(debt.rows()).toHaveLength(1);
  }
});

test("structural debt fixes distinguish partial from unavailable refcheck observations", () => {
  const artifact = DesignArtifactReference.of({
    location: IntentLocation.of(ArtifactPath.of("default"), ArtifactPath.of("intent")),
    tool: ArtifactPath.of("probe.ts"),
    artifactPath: ArtifactPath.of("/workspace/components.md"),
    relativePath: ArtifactPath.of("components.md"),
  });
  const debt = StructuralDebt.of([
    StructuralObservation.partial(artifact, FindingCount.of(1), ErrorMessage.of("skipped input")),
    StructuralObservation.unavailable(artifact, ErrorMessage.of("backend unavailable")),
  ]);
  const rows = presenter.structuralDebt(ok(debt));
  expect(rows[0]?.fix()).toContain("write mode");
  expect(rows[1]?.fix()).toContain("backend error");
});

test("design artifact discovery uses UTF-16 code-unit ordering independent of locale", () => {
  const { project, client } = workspace();
  const record = recordIn(project);
  for (const unit of ["a-unit", "Z-unit"]) {
    mkdirSync(join(record, "construction", unit, "functional-design"), { recursive: true });
    writeFileSync(join(record, "construction", unit, "functional-design", "entities.md"), "# entities\n");
  }
  const artifacts = requireSuccess(client.designArtifacts());
  expect(
    [...artifacts]
      .filter((artifact) => artifact.relativePath().asString().startsWith("construction/"))
      .map((artifact) => artifact.relativePath().asString()),
  ).toEqual(["construction/Z-unit/functional-design", "construction/a-unit/functional-design"]);
});

test("stage scopes support block and inline lists and distinguish missing from malformed", () => {
  const { harness, client } = workspace();
  const path = join(harness, "aidlc-common/stages/inception/deep-spec-analysis-verify.md");
  mkdirSync(join(harness, "aidlc-common/stages/inception"), { recursive: true });
  for (const [declaration, expected] of [
    ["scopes: [feature, refactor]", ["feature", "refactor"]],
    ["scopes: []", []],
    ["scopes:\n  - feature", ["feature"]],
  ] as const) {
    writeFileSync(path, `---\n${declaration}\n---\n`);
    expect([...requireSuccess(client.verificationCoverage()).scopes()].map((scope) => scope.asString())).toEqual([
      ...expected,
    ]);
  }
  writeFileSync(path, "---\nscopes: [feature\n---\n");
  expect(client.verificationCoverage().ok).toBe(false);
  rmSync(path);
  mkdirSync(path);
  const result = client.verificationCoverage();
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("io-failed");
});

test("requirements evidence retains byte-based source digests", () => {
  const { project, client } = workspace();
  const record = recordIn(project);
  const bytes = new Uint8Array([0xff, 0x61]);
  const model = { irVersion: "1.0.0", sourceDigest: ContentHash.ofBytes(bytes).asString() };
  mkdirSync(join(record, "inception/requirements-analysis"), { recursive: true });
  const stage = join(record, "inception/deep-spec-analysis-verify");
  mkdirSync(join(stage, "deep-spec-verify"), { recursive: true });
  writeFileSync(join(record, "inception/requirements-analysis/requirements.md"), bytes);
  writeFileSync(join(stage, "deep-spec-analysis-formal-model.md"), `\`\`\`json\n${JSON.stringify(model)}\n\`\`\`\n`);
  writeFileSync(
    join(stage, "deep-spec-verify/smt.json"),
    JSON.stringify({
      backend: "smt",
      irVersion: "1.0.0",
      irHash: ContentHash.ofText(canonicalStringify(model)).asString(),
      method: "exhaustive",
      findings: [],
      skipped: [],
    }),
  );
  expect(requireSuccess(client.verificationCoverage()).verifiedCount()).toBe(1);
});

test("solver discovery and provenance preserve unreadable paths", () => {
  const { project, harness } = workspace();
  writeFileSync(join(project, ".quint"), "not a directory");
  const result = new SolverProbeClientImplementation({
    projectDir: project,
    quintBin: process.execPath,
    apalacheDistDeclared: false,
    homeDir: project,
    apalachePort: 1,
    runtimeBin: process.execPath,
  }).availability();
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe("io-failed");
  expect(presenter.solvers(result)[0]?.passes()).toBe(false);
  expect(presenter.solvers(result)[0]?.label()).toContain("io-failed");
  mkdirSync(harness);
  writeFileSync(join(harness, "tools"), "not a directory");
  const provenance = new InstallationProvenanceClientImplementation({ harnessRoot: harness }).read();
  const state = provenance.match({
    unavailable: (advisory) => presenter.version(advisory).label(),
    installed: () => "installed",
  });
  expect(state).toContain("ENOTDIR");
});
