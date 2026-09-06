import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.cwd());
const baseline = "87f151776ef13dd2f564c2a60ff0d4f5968eab65";
// 測定対象と同じソースでのみ再現する。作業ブランチの変更を混ぜない。
execFileSync("git", ["diff", "--exit-code", baseline, "--", "deep-spec-analysis/src"], { cwd: root });
const at = (context: string) =>
  import(pathToFileURL(join(root, "deep-spec-analysis/src", context, "domain/index.ts")).href);
const kernel = await at("kernel");
const design = await at("design");
const requirements = await at("requirements");
const members = (values: readonly string[]) => kernel.EnumerationMembers.of(values.map(kernel.EnumerationMember.of));
const expression = (value: string) => ({
  op: "eq",
  args: [
    { op: "ref", path: "ticket.status" },
    { op: "enum", value },
  ],
});
const designEntity = (attributes: readonly { name: string; values: readonly string[] }[]) =>
  design.DesignEntityDeclaration.of({
    name: design.DesignEntityName.of("ticket"),
    attributes: design.DesignAttributeDeclarations.of(
      attributes.map((attribute) =>
        design.DesignAttributeDeclaration.of({
          name: design.DesignAttributeName.of(attribute.name),
          kind: kernel.AttributeKind.of("enum"),
          values: members(attribute.values),
        }),
      ),
    ),
  });
const declaration = (entities: ReturnType<typeof designEntity>[], value: string) =>
  design.DesignUnitDeclaration.of({
    unit: design.DesignUnitIdentifier.of("u1"),
    entities: design.DesignEntityDeclarations.of(entities),
    obligations: design.DesignObligationDeclarations.of([
      design.DesignObligationDeclaration.of({
        id: design.DesignObligationIdentifier.of("DOB-1"),
        assert: expression(value),
      }),
    ]),
    stateMachines: design.DesignMachineDeclarations.of([]),
    scenarios: design.DesignScenarioDeclarations.of([]),
    background: design.DesignBackgroundDeclarations.of([]),
    unformalizedTargets: design.UnformalizedTargets.of([]),
    directoryExists: true,
    rulesMarkdown: null,
  });

const attrs = [
  { name: "status", values: ["open"] },
  { name: "channel", values: ["email"] },
];
const requirementsDeclaration = requirements.IntermediateRepresentationModelDeclaration.of({
  entities: requirements.IntermediateRepresentationEntityDeclarations.of([
    requirements.IntermediateRepresentationEntityDeclaration.of({
      name: requirements.IntermediateRepresentationEntityName.of("ticket"),
      attributes: requirements.IntermediateRepresentationAttributeDeclarations.of(
        attrs.map((attribute) =>
          requirements.IntermediateRepresentationAttributeDeclaration.of({
            name: requirements.IntermediateRepresentationAttributeName.of(attribute.name),
            kind: kernel.AttributeKind.of("enum"),
            values: members(attribute.values),
          }),
        ),
      ),
    }),
  ]),
  obligations: requirements.IntermediateRepresentationObligationDeclarations.of([
    requirements.IntermediateRepresentationObligationDeclaration.of({
      id: requirements.ObligationIdentifier.of("OB-1"),
      assert: expression("email"),
    }),
  ]),
  scenarios: requirements.IntermediateRepresentationScenarioDeclarations.of([]),
  background: requirements.IntermediateRepresentationBackgroundDeclarations.of([]),
});
const requirementErrors = requirementsDeclaration.wellFormednessErrors();
const designErrors = declaration([designEntity(attrs)], "email").wellFormednessErrors();
if (requirementErrors.length !== 0 || designErrors.length !== 1) throw new Error("enum policy probe changed");

// 同一座標の異なる定義。検査とrefinementの照会が同じ宣言を解決するかを比較する。
const first = designEntity([{ name: "status", values: ["open"] }]);
const second = designEntity([{ name: "status", values: ["closed"] }]);
const duplicates = design.DesignEntityDeclarations.of([first, second]);
const duplicateErrors = declaration([first, second], "closed").wellFormednessErrors();
const unit = design.DesignUnit.of({
  unit: "u1",
  entities: duplicates,
  obligations: design.DesignObligations.of([]),
  machines: design.DesignMachines.of([]),
  scenarios: design.DesignScenarios.of([]),
  background: design.DesignBackgroundAssumptions.of([]),
});
const resolvedValues = unit.declaredEnumValuesOf("ticket.status");
if (duplicateErrors.length !== 0 || JSON.stringify(resolvedValues) !== '["open"]')
  throw new Error("duplicate resolution probe changed");

// 実センサーにも重複が届くことを、正常fixtureとの比較で確認する。
const record = mkdtempSync(join(tmpdir(), "domain-cohesion-cli-"));
const cliEvidence: object[] = [];
try {
  cpSync(join(root, "deep-spec-analysis/tests/fixtures/design/record"), record, { recursive: true });
  const modelPath = join(
    record,
    "construction/deep-spec-analysis-functional-verify/deep-spec-analysis-functional-formal-model.md",
  );
  const runSensor = () => {
    const run = spawnSync(
      "bun",
      [
        join(root, "deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-design-ir-valid.ts"),
        "--stage",
        "deep-spec-analysis-functional-verify",
        "--output-path",
        modelPath,
      ],
      { encoding: "utf8", timeout: 30_000 },
    );
    if (run.status !== 0) throw new Error(`sensor probe failed: ${run.stderr}`);
    return { exit: run.status, verdict: JSON.parse(run.stdout) };
  };
  cliEvidence.push({ case: "canonical-fixture", ...runSensor() });
  const markdown = readFileSync(modelPath, "utf8");
  const fence = /```json\s*\n([\s\S]*?)```/.exec(markdown);
  if (fence === null) throw new Error("fixture JSON fence missing");
  const document = JSON.parse(fence[1]);
  const entities = document.units[0].schema.entities;
  entities.push(structuredClone(entities[0]));
  writeFileSync(modelPath, markdown.replace(fence[1], JSON.stringify(document, null, 2) + "\n"));
  const duplicateRun = runSensor();
  if (duplicateRun.verdict.pass !== true || duplicateRun.verdict.findings_count !== 0)
    throw new Error("duplicate CLI probe changed");
  cliEvidence.push({ case: "duplicated-entity", duplicatedName: entities[0].name, ...duplicateRun });
} finally {
  rmSync(record, { recursive: true, force: true });
}

// public factoryの引数だけで、対を持たない影プローブを構築できるかを確認する。
const origin = design.LoweredOrigin.of({ design: design.LoweredOriginReference.of("DOB-1"), kind: "vac-shadow" });
const index = design.LoweringIndex.of({
  origins: kernel.KeyedIndex.of([[design.LoweredIdentifier.of("OB-1"), origin]]),
  scenarioDesignIds: kernel.KeyedIndex.of([]),
  machinesByTransition: kernel.KeyedIndex.of([]),
  attrPathsByMachine: kernel.KeyedIndex.of([]),
});
const sibling = design.SiblingVerdictDocument.readable(
  kernel.VerificationMethod.of("exhaustive"),
  design.SiblingVerdictFindings.of([
    design.SiblingVerdictFinding.of({
      kind: kernel.FindingKind.conflict(),
      functionalRequirementReferences: kernel.FunctionalRequirementReferences.of([]),
      targets: [design.LoweredIdentifier.of("OB-1")],
      witness: design.DesignWitness.core([]),
      detail: "probe",
    }),
  ]),
  design.SiblingVerdictSkips.of([]),
);
const remapped = sibling.remapVerdicts(unit, index);
const findings = [...remapped.findings].map((finding) => ({ kind: finding.kind(), detail: finding.detail() }));
if (findings.length !== 1 || !findings[0].detail.startsWith("DOB-1 is subsumed by DOB-1"))
  throw new Error("self-subsumption probe changed");

const result = {
  baseline,
  sourceCheckout: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  sourceDiffAgainstBaseline: "none",
  enumPolicy: {
    requirementErrors,
    designErrors,
    status: "intentional difference documented at docs/decisions.ja.md:221",
  },
  duplicateEntity: {
    coordinate: "ticket.status",
    declarationValues: [["open"], ["closed"]],
    assertionValue: "closed",
    errors: duplicateErrors,
    refinementLookup: resolvedValues,
  },
  duplicateEntitySensor: cliEvidence,
  missingShadowPair: {
    input: { kind: "vac-shadow", design: "DOB-1", pair: "omitted" },
    constructedPair: origin.pairRefs().map((reference) => reference.asString()),
    findings,
  },
};
writeFileSync(join(import.meta.dir, "runtime-evidence.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
