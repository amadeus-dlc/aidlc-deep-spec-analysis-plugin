import { InitialState } from "@deep-spec/design-domain";
import {
  ArtifactPath,
  AttributeBound,
  AttributeKind,
  AttributePath,
  BindingDeclaration,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  DeclaredBound,
  DeclaredDigest,
  EnumerationMember,
  EnumerationMembers,
  ErrorMessage,
  ErrorMessages,
  IntermediateRepresentationVersion,
  RequirementIdentifier,
  RequirementIdentifiers,
  TargetIdentifier,
  TriggerName,
} from "@deep-spec/kernel-domain";
import type { Json } from "@deep-spec/kernel-infrastructure";

// 契約1／契約3 の IR バリデータを in-process で駆動するスイート（PR7）。
//
// 主証拠は「子プロセスで実センサーを撃った verdict 行」と「同じ入力を
// in-process のインタラクタ＋実 Impl で処理した結果」のバイト一致。両者が
// 一致する限り、well-formedness の移設は観測面を動かしていない。
// 併せて、子プロセス経由では in-process 計測に乗らないドメインの分岐を
// 直接叩く（domain 層 90% 床の担保）。

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation,
  DesignModelRepositoryImplementation,
} from "@deep-spec/design-adapter";
import {
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundDeclaration,
  DesignBackgroundDeclarations,
  DesignBackgroundIdentifier,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignIgnoreDeclaration,
  DesignIgnoreDeclarations,
  DesignIntermediateRepresentationValidationMaterialsIdentifier,
  DesignMachineDeclaration,
  DesignMachineDeclarations,
  DesignMachineIdentifier,
  DesignModelIdentifier,
  DesignObligationDeclaration,
  DesignObligationDeclarations,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignScenarioDeclaration,
  DesignScenarioDeclarations,
  DesignScenarioIdentifier,
  DesignTransitionDeclaration,
  DesignTransitionDeclarations,
  DesignTransitionIdentifier,
  DesignUnitDeclaration,
  DesignUnitDeclarations,
  DesignUnitIdentifier,
  InitialStates,
  UnformalizedTargets,
} from "@deep-spec/design-domain";
import {
  type ValidateDesignIntermediateRepresentationOutcome,
  ValidateDesignIntermediateRepresentationUseCase,
} from "@deep-spec/design-usecase";
import {
  FormalModelRepositoryImplementation,
  IntermediateRepresentationValidationMaterialsRepositoryImplementation,
  RequirementsSourceRepositoryImplementation,
} from "@deep-spec/requirements-adapter";
import {
  BackgroundAssumptionIdentifier,
  FormalModelIdentifier,
  FunctionalRequirementReferenceClaim,
  FunctionalRequirementReferenceClaims,
  FunctionalRequirementReferenceIndex,
  FunctionalRequirementReferences,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationAttributeName,
  IntermediateRepresentationBackgroundDeclaration,
  IntermediateRepresentationBackgroundDeclarations,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
  IntermediateRepresentationModelDeclaration,
  IntermediateRepresentationObligationDeclaration,
  IntermediateRepresentationObligationDeclarations,
  IntermediateRepresentationScenarioDeclaration,
  IntermediateRepresentationScenarioDeclarations,
  IntermediateRepresentationTemporalDeclaration,
  IntermediateRepresentationValidationMaterials,
  IntermediateRepresentationValidationMaterialsIdentifier,
  ObligationIdentifier,
  RequirementsSource,
  RequirementsSourceIdentifier,
  RequirementsSourceValidation,
  ScenarioIdentifier,
  SourceAnchor,
} from "@deep-spec/requirements-domain";
import {
  type ValidateIntermediateRepresentationOutcome,
  ValidateIntermediateRepresentationUseCase,
} from "@deep-spec/requirements-usecase";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = join(pluginRoot, "tools");
// スキーマ原本はソースツリー側（src/entries/data/）。toolsDir は生成される配布物の
// spawn 先で、原本の置き場ではない。
const dataDir = join(pluginRoot, "src", "entries", "data");
const fixtures = join(pluginRoot, "tests", "fixtures");
const irSchemaPath = join(dataDir, "deep-spec-ir-schema.json");
const designSchemaPath = join(dataDir, "deep-spec-design-ir-schema.json");

const MAX_REPORTED_ERRORS = 25;

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

// entry の描画と同一の行を組む（比較対象は子プロセスの stdout そのもの）。
function renderVerdict(
  outcome: ValidateIntermediateRepresentationOutcome | ValidateDesignIntermediateRepresentationOutcome,
): string {
  if (outcome.kind === "not-applicable") {
    return `${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}\n`;
  }
  const errors =
    outcome.kind === "acquisition-failed"
      ? [outcome.error.cause]
      : [...outcome.assessment.errors()].map((message) => message.asString());
  return `${JSON.stringify({
    pass: outcome.kind === "verdict" && outcome.assessment.passes(),
    findings_count: errors.length,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
  })}\n`;
}

function fire(tool: string, stage: string, outputPath: string): string {
  const res = spawnSync("bun", [join(toolsDir, tool), "--stage", stage, "--output-path", outputPath], {
    encoding: "utf-8",
    timeout: 120_000,
  });
  expect(res.status).toBe(0);
  return res.stdout ?? "";
}

function makeIrRecord(modelFixture: string): { record: string; modelPath: string } {
  const record = join(tmpdir(), `deep-spec-ir-valid-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(record, "inception", "requirements-analysis"), { recursive: true });
  mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
  cpSync(
    join(fixtures, "conformance", "requirements.md"),
    join(record, "inception", "requirements-analysis", "requirements.md"),
  );
  const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
  cpSync(modelFixture, modelPath);
  return { record, modelPath };
}

function makeDesignRecord(): { record: string; modelPath: string } {
  const record = join(tmpdir(), `deep-spec-design-ir-valid-${Math.random().toString(36).slice(2)}`);
  cpSync(join(fixtures, "design", "record"), record, { recursive: true });
  return {
    record,
    modelPath: join(
      record,
      "construction",
      "deep-spec-analysis-functional-verify",
      "deep-spec-analysis-functional-formal-model.md",
    ),
  };
}

function irUseCase(): ValidateIntermediateRepresentationUseCase {
  return new ValidateIntermediateRepresentationUseCase(
    new IntermediateRepresentationValidationMaterialsRepositoryImplementation({ schemaPath: irSchemaPath }),
    new RequirementsSourceRepositoryImplementation(),
  );
}

function designUseCase(): ValidateDesignIntermediateRepresentationUseCase {
  return new ValidateDesignIntermediateRepresentationUseCase(
    new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({ schemaPath: designSchemaPath }),
  );
}

describe("要件検査の診断予算", () => {
  function emptyDeclaration(): IntermediateRepresentationModelDeclaration {
    return IntermediateRepresentationModelDeclaration.of({
      entities: IntermediateRepresentationEntityDeclarations.of([]),
      obligations: IntermediateRepresentationObligationDeclarations.of([]),
      scenarios: IntermediateRepresentationScenarioDeclarations.of([]),
      background: IntermediateRepresentationBackgroundDeclarations.of([]),
    });
  }

  test.each(["1.0.0", "2.0.0"])("最大件数のschema診断と版診断を保持する (%s)", (version) => {
    const materials = IntermediateRepresentationValidationMaterials.of({
      id: IntermediateRepresentationValidationMaterialsIdentifier.of(FormalModelIdentifier.of(ap("/record/model.md"))),
      irVersion: IntermediateRepresentationVersion.of(version),
      schemaErrors: ErrorMessages.of(Array.from({ length: 65_536 }, () => ErrorMessage.of("schema diagnosis"))),
      view: emptyDeclaration(),
      functionalRequirementReferenceClaims: FunctionalRequirementReferenceClaims.of([]),
      declaredDigest: null,
      sourceId: RequirementsSourceIdentifier.of(ap("/record")),
      sourceDocument: new Uint8Array(),
    });
    const assessment = materials.validate({
      complete: (assessment) => assessment,
      sourceRequired: () => {
        throw new Error("schema-invalid input must not proceed to source validation");
      },
    });
    const messages = [...assessment.errors()].map((message) => message.asString());
    expect(assessment.passes()).toBe(false);
    expect(messages).toHaveLength(65_536);
    if (version === "1.0.0") {
      expect(messages[0]).toBe("schema diagnosis");
      expect(messages.at(-1)).toBe("schema diagnosis");
    } else {
      expect(messages[0]).toBe("irVersion 2.0.0: unsupported major version (this validator supports 1.x.x)");
      expect(messages[1]).toBe("schema diagnosis");
      expect(messages.at(-1)).toBe(
        "validation diagnostic limit reached (65536 messages); additional diagnostics omitted",
      );
    }
  });

  test("多数のownerを含む参照診断が文字数上限を超えても検査を失わない", () => {
    const references = FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]);
    const index = FunctionalRequirementReferenceIndex.of(
      Array.from({ length: 600 }, (_, position) =>
        FunctionalRequirementReferenceClaim.of(`OB-${position}`.padEnd(128, "x"), references),
      ),
    );
    const digest = ContentHash.ofText("requirements");
    const validation = RequirementsSourceValidation.of(emptyDeclaration(), index, DeclaredDigest.of(digest.asString()));
    const source = RequirementsSource.of({
      id: RequirementsSourceIdentifier.of(ap("/record")),
      sourcePath: ap("/record/requirements.md"),
      knownIds: RequirementIdentifiers.of([]),
      digest,
      sourceDocument: new TextEncoder().encode("requirements"),
    });
    const assessment = validation.assess(source);
    expect(assessment.passes()).toBe(false);
    expect([...assessment.errors()].map((message) => message.asString())).toEqual([
      "validation diagnostic could not be represented within its text budget",
    ]);
  });
});

describe("ValidateIntermediateRepresentationUseCase reproduces the ir-valid sensor byte-for-byte", () => {
  const stage = "deep-spec-analysis-verify";

  test("canonical fixture", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("broken fixture — semantic defects and frRef traceability", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "invalid", "deep-spec-analysis-formal-model.md"));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).pass).toBe(false);
  });

  test("drifted requirements — sourceDigest mismatch", () => {
    const { record, modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const req = join(record, "inception", "requirements-analysis", "requirements.md");
    writeFileSync(req, `${readFileSync(req, "utf-8")}\n- FR-9: 監査ログを5年間保持しなければならない。\n`);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain("does not match requirements.md");
  });

  test("missing sourceDigest — the value to add is handed back", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, readFileSync(modelPath, "utf-8").replace(/^\s*"sourceDigest": "[0-9a-f]{64}",\n/m, ""));
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors.join("\n")).toContain('add "sourceDigest"');
  });

  test("requirements.md absent — frRefs cannot be reverse-verified", () => {
    const record = join(tmpdir(), `deep-spec-ir-valid-noreq-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "inception", "deep-spec-analysis-verify"), { recursive: true });
    const modelPath = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
    cpSync(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors).toContain(
      "requirements.md not found under this intent record — frRefs cannot be reverse-verified",
    );
  });

  test("fence and JSON failures short-circuit before the version check", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(modelPath, "# no fence here\n");
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath),
    );
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const useCase = new ValidateIntermediateRepresentationUseCase(
      new IntermediateRepresentationValidationMaterialsRepositoryImplementation({
        schemaPath: join(tmpdir(), "no-such-ir-schema.json"),
      }),
      new RequirementsSourceRepositoryImplementation(),
    );
    const outcome = useCase.execute(FormalModelIdentifier.of(ap(modelPath)));
    expect(outcome.kind).toBe("acquisition-failed");
    if (outcome.kind !== "acquisition-failed") return;
    expect(outcome.error.cause).toContain("IR schema not installed at");
  });

  test("unsupported major version is reported before the schema errors", () => {
    const { modelPath } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    writeFileSync(
      modelPath,
      readFileSync(modelPath, "utf-8").replace(/"irVersion": "1\.[0-9]+\.[0-9]+"/, '"irVersion": "2.0.0"'),
    );
    const viaSensor = fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the formal model is not applicable", () => {
    const { record } = makeIrRecord(join(fixtures, "conformance", "deep-spec-analysis-formal-model.md"));
    const other = join(record, "inception", "deep-spec-analysis-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(irUseCase().execute(FormalModelIdentifier.of(ap(other))).kind).toBe("not-applicable");
    expect(renderVerdict(irUseCase().execute(FormalModelIdentifier.of(ap(other))))).toBe(
      fire("aidlc-sensor-deep-spec-ir-valid.ts", stage, other),
    );
  });
});

describe("ValidateDesignIntermediateRepresentationUseCase reproduces the design-ir-valid sensor byte-for-byte", () => {
  const stage = "deep-spec-analysis-functional-verify";

  test("canonical fixture", () => {
    const { modelPath } = makeDesignRecord();
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("invalid fixture — every planted defect, in the frozen order", () => {
    const { modelPath } = makeDesignRecord();
    cpSync(join(fixtures, "design", "invalid-formal-model.md"), modelPath);
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    const verdict = JSON.parse(viaSensor);
    expect(verdict.pass).toBe(false);
    const all = verdict.errors.join("\n");
    expect(all).toContain('duplicate id "TR-1"');
    expect(all).toContain("assigns the machine's own attribute");
    expect(all).toContain("BR coverage: rule BR1.3");
    expect(all).toContain("no construction/u9-ghost/ directory exists");
  });

  test("fence and JSON failures short-circuit", () => {
    const { modelPath } = makeDesignRecord();
    writeFileSync(modelPath, "# no fence\n");
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n{ not json\n```\n");
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );

    writeFileSync(modelPath, "```json\n[]\n```\n");
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(
      fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath),
    );
  });

  test("schema absent — the acquisition fails before anything else", () => {
    const { modelPath } = makeDesignRecord();
    const useCase = new ValidateDesignIntermediateRepresentationUseCase(
      new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({
        schemaPath: join(tmpdir(), "no-such-design-schema.json"),
      }),
    );
    const outcome = useCase.execute(DesignModelIdentifier.of(ap(modelPath)));
    expect(outcome.kind).toBe("acquisition-failed");
    if (outcome.kind !== "acquisition-failed") return;
    expect("cause" in outcome.error && outcome.error.cause).toContain("design IR schema not installed at");
  });

  test("unsupported major version", () => {
    const { modelPath } = makeDesignRecord();
    writeFileSync(
      modelPath,
      readFileSync(modelPath, "utf-8").replace(/"irVersion": "1\.[0-9]+\.[0-9]+"/, '"irVersion": "3.0.0"'),
    );
    const viaSensor = fire("aidlc-sensor-deep-spec-design-ir-valid.ts", stage, modelPath);
    expect(renderVerdict(designUseCase().execute(DesignModelIdentifier.of(ap(modelPath))))).toBe(viaSensor);
    expect(JSON.parse(viaSensor).errors[0]).toContain("unsupported major version");
  });

  test("a write that is not the functional formal model is not applicable", () => {
    const { record } = makeDesignRecord();
    const other = join(record, "construction", "deep-spec-analysis-functional-verify", "notes.md");
    writeFileSync(other, "# notes\n");
    expect(designUseCase().execute(DesignModelIdentifier.of(ap(other))).kind).toBe("not-applicable");
  });
});

describe("FunctionalRequirementReferenceIndex", () => {
  test("collects owners per frRef and reports the missing ones sorted", () => {
    const index = FunctionalRequirementReferenceIndex.of([
      FunctionalRequirementReferenceClaim.of(
        "OB-2",
        FunctionalRequirementReferences.of(Array.from(["FR-1", "FR-9"], (raw) => RequirementIdentifier.of(raw))),
      ),
      FunctionalRequirementReferenceClaim.of(
        "OB-1",
        FunctionalRequirementReferences.of(Array.from(["FR-9"], (raw) => RequirementIdentifier.of(raw))),
      ),
      FunctionalRequirementReferenceClaim.of("scenarios[3]", FunctionalRequirementReferences.of([])),
    ]);
    expect(index.referencedIds().sort()).toEqual(["FR-1", "FR-9"]);
    expect(
      index.missingErrors(RequirementIdentifiers.of(Array.from(["FR-1"], (raw) => RequirementIdentifier.of(raw)))),
    ).toEqual(['frRef "FR-9" (used by OB-1, OB-2) does not exist in requirements.md']);
    expect(
      index.missingErrors(
        RequirementIdentifiers.of(Array.from(["FR-1", "FR-9"], (raw) => RequirementIdentifier.of(raw))),
      ),
    ).toEqual([]);
  });
});

describe("RequirementsSourceIdentifier", () => {
  test("identity is the record root, compared by value", () => {
    const a = RequirementsSourceIdentifier.of(ap("/records/r1"));
    const b = RequirementsSourceIdentifier.of(ap("/records/r1"));
    const c = RequirementsSourceIdentifier.of(ap("/records/r2"));
    expect(a.recordRoot().asString()).toBe("/records/r1");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  test("the repository resolves by the aggregate id, wherever the phase directory sits", () => {
    const record = join(tmpdir(), `deep-spec-source-id-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "construction", "requirements-analysis"), { recursive: true });
    writeFileSync(join(record, "construction", "requirements-analysis", "requirements.md"), "- FR-1: x\n");
    const source = new RequirementsSourceRepositoryImplementation().findById(
      RequirementsSourceIdentifier.of(ap(record)),
    );
    expect(source.ok).toBe(true);
    expect([...(source.ok ? source.value.knownIds() : [])].map((id) => id.asString())).toEqual(["FR-1"]);
    const missing = new RequirementsSourceRepositoryImplementation().findById(
      RequirementsSourceIdentifier.of(ap(join(record, "nowhere"))),
    );
    expect(!missing.ok && missing.error.kind).toBe("not-found");
  });
});

describe("SourceAnchor", () => {
  test("an absent digest hands back the value to stamp", () => {
    expect(SourceAnchor.of(null, ContentHash.ofText("actual")).errors()).toEqual([
      `IR has no sourceDigest — requirements drift would be undetectable; add "sourceDigest": "${ContentHash.ofText("actual").asString()}" (sha256 of requirements.md) to the IR`,
    ]);
  });

  test("a drifted digest names both sides", () => {
    expect(SourceAnchor.of(DeclaredDigest.of("old"), ContentHash.ofText("new")).errors()).toEqual([
      `sourceDigest old does not match requirements.md (sha256 ${ContentHash.ofText("new").asString()}) — the requirements changed since formalization; re-formalize against the current text and restamp the digest`,
    ]);
  });

  test("a matching digest is silent", () => {
    expect(
      SourceAnchor.of(DeclaredDigest.of(ContentHash.ofText("same").asString()), ContentHash.ofText("same")).errors(),
    ).toEqual([]);
  });
});

describe("BusinessRuleReferenceIndex", () => {
  test("extracts BR ids from rules markdown", () => {
    const index = BusinessRuleReferenceIndex.fromRules(
      "- BR2.1 なにか\n- BR1.10 別の規則\n- BR1.10 再掲\n- BRX.1 は id ではない\n",
    );
    expect(index.sortedIds()).toEqual(["BR1.10", "BR2.1"]);
    expect(index.has(BusinessRuleReference.of("BR2.1"))).toBe(true);
    expect(index.has(BusinessRuleReference.of("BR9.9"))).toBe(false);
  });
});

describe("modelWellFormednessErrors (contract 1 domain branches)", () => {
  // テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
  type RawIrAttr = { name: string; kind: string; values?: string[]; min?: number; max?: number };
  type RawIrEntity = { name: string; attributes: RawIrAttr[] };
  type RawIrObligation = Omit<
    Parameters<typeof IntermediateRepresentationObligationDeclaration.of>[0],
    "id" | "temporal"
  > & { id: string; temporal?: Parameters<typeof IntermediateRepresentationTemporalDeclaration.of>[0] };
  type RawIrScenario = Omit<
    Parameters<typeof IntermediateRepresentationScenarioDeclaration.of>[0],
    "id" | "bindings"
  > & { id: string; bindings: (readonly [string, Json])[] };
  type RawIrBackground = Omit<Parameters<typeof IntermediateRepresentationBackgroundDeclaration.of>[0], "id"> & {
    id: string;
  };
  function irView(overrides: {
    entities?: RawIrEntity[];
    obligations?: RawIrObligation[];
    scenarios?: RawIrScenario[];
    background?: RawIrBackground[];
  }): IntermediateRepresentationModelDeclaration {
    return IntermediateRepresentationModelDeclaration.of({
      entities: IntermediateRepresentationEntityDeclarations.of(
        (overrides.entities ?? []).map((e) =>
          IntermediateRepresentationEntityDeclaration.of({
            name: IntermediateRepresentationEntityName.of(e.name),
            attributes: IntermediateRepresentationAttributeDeclarations.of(
              e.attributes.map((a) =>
                IntermediateRepresentationAttributeDeclaration.of({
                  ...a,
                  kind: AttributeKind.of(a.kind),
                  name: IntermediateRepresentationAttributeName.of(a.name),
                  min: a.min === undefined ? undefined : DeclaredBound.of(a.min),
                  max: a.max === undefined ? undefined : DeclaredBound.of(a.max),
                  values:
                    a.values === undefined
                      ? undefined
                      : EnumerationMembers.of(a.values.map((value) => EnumerationMember.of(value))),
                }),
              ),
            ),
          }),
        ),
      ),
      obligations: IntermediateRepresentationObligationDeclarations.of(
        (overrides.obligations ?? []).map((ob) =>
          IntermediateRepresentationObligationDeclaration.of({
            ...ob,
            id: ObligationIdentifier.of(ob.id),
            temporal:
              ob.temporal === undefined ? undefined : IntermediateRepresentationTemporalDeclaration.of(ob.temporal),
          }),
        ),
      ),
      scenarios: IntermediateRepresentationScenarioDeclarations.of(
        (overrides.scenarios ?? []).map((sc) =>
          IntermediateRepresentationScenarioDeclaration.of({
            ...sc,
            id: ScenarioIdentifier.of(sc.id),
            bindings: DeclaredBindings.of(
              sc.bindings.map(([path, value]) =>
                BindingDeclaration.of(AttributePath.of(path), DeclaredBindingValue.of(Declaration.of(value))),
              ),
            ),
          }),
        ),
      ),
      background: IntermediateRepresentationBackgroundDeclarations.of(
        (overrides.background ?? []).map((bg) =>
          IntermediateRepresentationBackgroundDeclaration.of({ ...bg, id: BackgroundAssumptionIdentifier.of(bg.id) }),
        ),
      ),
    });
  }

  test("a well-formed model is silent", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "qty", kind: "int", min: 0, max: 5 }] }],
        obligations: [{ id: "OB-1", assert: { op: "ref", path: "order.qty" } }],
      }).wellFormednessErrors(),
    ).toEqual([]);
  });

  test("duplicate entities and attributes, and an inverted int range", () => {
    expect(
      irView({
        entities: [
          {
            name: "order",
            attributes: [
              { name: "qty", kind: "int", min: 9, max: 1 },
              { name: "qty", kind: "bool" },
            ],
          },
          { name: "order", attributes: [] },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      "schema: order.qty: min > max",
      'schema: duplicate attribute "order.qty"',
      'schema: duplicate entity "order"',
    ]);
  });

  test("colliding encodings, unsafe bounds, and an unsafe binding are rejected (thaw #34)", () => {
    expect(
      irView({
        entities: [
          { name: "a", attributes: [{ name: "b_c", kind: "bool" }] },
          { name: "a_b", attributes: [{ name: "c", kind: "bool" }] },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      'schema: attribute paths "a.b_c" and "a_b.c" collide under the solver variable encoding (dots become underscores)',
    ]);
    expect(
      irView({
        entities: [{ name: "o", attributes: [{ name: "n", kind: "int", min: 0, max: 1e21 }] }],
      }).wellFormednessErrors(),
    ).toEqual(["schema: o.n: bounds must be safe integers"]);
    expect(
      irView({
        entities: [{ name: "o", attributes: [{ name: "n", kind: "int", min: 0, max: 9 }] }],
        scenarios: [{ id: "SC-1", bindings: [["o.n", 1e21]], hasEvent: false }],
      }).wellFormednessErrors(),
    ).toEqual(['scenario SC-1: binding value 1e+21 does not fit int attribute "o.n"']);
  });

  test("unresolvable references, illegal primes and unknown enum literals", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "status", kind: "enum", values: ["open"] }] }],
        obligations: [
          {
            id: "OB-1",
            assert: {
              op: "and",
              args: [
                { op: "ref", path: "order.total" },
                { op: "ref", path: "order.status", prime: true },
                { op: "enum", value: "closed" },
              ],
            },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      'obligation OB-1: unresolvable reference "order.total"',
      'obligation OB-1: primed reference "order.status" is only legal in event effects and event-scenario expectations',
      'obligation OB-1: enum literal "closed" is not a value of any declared enum attribute',
    ]);
  });

  test("primes are legal inside an effect, and temporal branches are walked", () => {
    expect(
      irView({
        entities: [{ name: "order", attributes: [{ name: "qty", kind: "int", min: 0, max: 2 }] }],
        obligations: [
          {
            id: "OB-1",
            effect: { op: "ref", path: "order.qty", prime: true },
            guard: { op: "ref", path: "order.qty" },
            temporal: {
              assert: { op: "ref", path: "order.ghost" },
              from: { op: "ref", path: "order.qty" },
              to: { op: "ref", path: "order.qty" },
            },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual(['obligation OB-1: unresolvable reference "order.ghost"']);
  });

  test("duplicate ids are reported within each typed ID namespace", () => {
    expect(
      irView({
        obligations: [{ id: "OB-1" }, { id: "OB-1" }],
        scenarios: [
          { id: "SC-1", bindings: [], hasEvent: false },
          { id: "SC-1", bindings: [], hasEvent: false },
        ],
        background: [{ id: "BG-1" }, { id: "BG-1" }],
      }).wellFormednessErrors(),
    ).toEqual([
      'obligation OB-1: duplicate id "OB-1"',
      'scenario SC-1: duplicate id "SC-1"',
      'background BG-1: duplicate id "BG-1"',
    ]);
  });

  test("scenario bindings are typed against the attribute catalogue", () => {
    expect(
      irView({
        entities: [
          {
            name: "order",
            attributes: [
              { name: "qty", kind: "int", min: 0, max: 5 },
              { name: "blocked", kind: "bool" },
              { name: "status", kind: "enum", values: ["open"] },
            ],
          },
        ],
        scenarios: [
          {
            id: "SC-1",
            bindings: [
              ["order.qty", 1.5],
              ["order.blocked", true],
              ["order.status", "closed"],
              ["order.ghost", 1],
            ],
            hasEvent: true,
            expect: { op: "ref", path: "order.qty", prime: true },
          },
        ],
      }).wellFormednessErrors(),
    ).toEqual([
      'scenario SC-1: binding value 1.5 does not fit int attribute "order.qty"',
      'scenario SC-1: binding value "closed" does not fit enum attribute "order.status"',
      'scenario SC-1: binding for unknown attribute "order.ghost"',
    ]);
  });

  test("background assertions are walked", () => {
    expect(irView({ background: [{ id: "BG-1", assert: { op: "ref", path: "a.b" } }] }).wellFormednessErrors()).toEqual(
      ['background BG-1: unresolvable reference "a.b"'],
    );
  });
});

describe("DesignUnitDeclarations.wellFormednessErrors (contract 3 domain branches)", () => {
  // テストの読みやすさのため素の配列で書き、ここで一括してコレクションに包む。
  type RawAttr = { name: string; kind: string; values?: string[]; min?: number; max?: number };
  type RawEntity = { name: string; attributes: RawAttr[] };
  type RawObligation = Omit<
    Parameters<typeof DesignObligationDeclaration.of>[0],
    "id" | "origin" | "businessRuleReferences"
  > & { id: string; origin?: string; brRefs?: string[] };
  type RawTransition = Omit<
    Parameters<typeof DesignTransitionDeclaration.of>[0],
    "id" | "businessRuleReferences" | "trigger"
  > & { id: string; brRefs?: string[]; trigger?: string };
  type RawIgnore = Omit<Parameters<typeof DesignIgnoreDeclaration.of>[0], "trigger"> & { trigger: string };
  type RawMachine = Omit<
    Parameters<typeof DesignMachineDeclaration.of>[0],
    "id" | "initial" | "transitions" | "ignores"
  > & {
    id: string;
    initial: string[];
    transitions: RawTransition[];
    ignores: RawIgnore[];
  };
  type RawScenario = Omit<
    Parameters<typeof DesignScenarioDeclaration.of>[0],
    "id" | "bindings" | "businessRuleReferences"
  > & {
    id: string;
    bindings: (readonly [string, Json])[];
    brRefs?: string[];
  };
  type RawBackground = Omit<Parameters<typeof DesignBackgroundDeclaration.of>[0], "id"> & { id: string };
  type RawUnit = {
    entities?: RawEntity[];
    obligations?: RawObligation[];
    stateMachines?: RawMachine[];
    scenarios?: RawScenario[];
    background?: RawBackground[];
    unformalizedTargets?: string[];
    directoryExists?: boolean;
    rulesMarkdown?: string | null;
  };
  const brRefs = (refs: string[] | undefined) =>
    refs === undefined
      ? undefined
      : BusinessRuleReferences.of(Array.from(refs, (raw) => BusinessRuleReference.of(raw)));
  function unit(overrides: RawUnit): DesignUnitDeclaration {
    return DesignUnitDeclaration.of({
      unit: DesignUnitIdentifier.of("u1"),
      entities: DesignEntityDeclarations.of(
        (overrides.entities ?? []).map((e) =>
          DesignEntityDeclaration.of({
            name: DesignEntityName.of(e.name),
            attributes: DesignAttributeDeclarations.of(
              e.attributes.map((a) =>
                DesignAttributeDeclaration.of({
                  ...a,
                  kind: AttributeKind.of(a.kind),
                  name: DesignAttributeName.of(a.name),
                  min: a.min === undefined ? undefined : DeclaredBound.of(a.min),
                  max: a.max === undefined ? undefined : DeclaredBound.of(a.max),
                  values:
                    a.values === undefined
                      ? undefined
                      : EnumerationMembers.of(a.values.map((value) => EnumerationMember.of(value))),
                }),
              ),
            ),
          }),
        ),
      ),
      obligations: DesignObligationDeclarations.of(
        (overrides.obligations ?? []).map((ob) =>
          DesignObligationDeclaration.of({
            ...ob,
            id: DesignObligationIdentifier.of(ob.id),
            origin: ob.origin === undefined ? undefined : DesignObligationOrigin.of(ob.origin),
            businessRuleReferences: brRefs(ob.brRefs),
          }),
        ),
      ),
      stateMachines: DesignMachineDeclarations.of(
        (overrides.stateMachines ?? []).map((sm) =>
          DesignMachineDeclaration.of({
            ...sm,
            id: DesignMachineIdentifier.of(sm.id),
            initial: InitialStates.of(sm.initial.map((value) => InitialState.of(value))),
            transitions: DesignTransitionDeclarations.of(
              sm.transitions.map((tr) =>
                DesignTransitionDeclaration.of({
                  ...tr,
                  id: DesignTransitionIdentifier.of(tr.id),
                  businessRuleReferences: brRefs(tr.brRefs),
                  trigger: tr.trigger === undefined ? undefined : TriggerName.of(tr.trigger),
                }),
              ),
            ),
            ignores: DesignIgnoreDeclarations.of(
              sm.ignores.map((g) => DesignIgnoreDeclaration.of({ ...g, trigger: TriggerName.of(g.trigger) })),
            ),
          }),
        ),
      ),
      scenarios: DesignScenarioDeclarations.of(
        (overrides.scenarios ?? []).map((sc) =>
          DesignScenarioDeclaration.of({
            ...sc,
            id: DesignScenarioIdentifier.of(sc.id),
            bindings: DeclaredBindings.of(
              sc.bindings.map(([path, value]) =>
                BindingDeclaration.of(AttributePath.of(path), DeclaredBindingValue.of(Declaration.of(value))),
              ),
            ),
            businessRuleReferences: brRefs(sc.brRefs),
          }),
        ),
      ),
      background: DesignBackgroundDeclarations.of(
        (overrides.background ?? []).map((bg) =>
          DesignBackgroundDeclaration.of({ ...bg, id: DesignBackgroundIdentifier.of(bg.id) }),
        ),
      ),
      unformalizedTargets: UnformalizedTargets.of(
        Array.from(overrides.unformalizedTargets ?? [], (raw) => TargetIdentifier.of(raw)),
      ),
      directoryExists: overrides.directoryExists ?? true,
      rulesMarkdown: overrides.rulesMarkdown ?? null,
    });
  }

  test("duplicate unit names are reported once per repeat", () => {
    expect(DesignUnitDeclarations.of([unit({}), unit({})]).wellFormednessErrors()).toEqual(['duplicate unit "u1"']);
  });

  test("design-side colliding encodings and unsafe bounds are rejected (thaw #34)", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [
            { name: "a", attributes: [{ name: "b_c", kind: "bool" }] },
            { name: "a_b", attributes: [{ name: "c", kind: "bool" }] },
          ],
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      'unit u1: attribute paths "a.b_c" and "a_b.c" collide under the solver variable encoding (dots become underscores)',
    ]);
    expect(
      DesignUnitDeclarations.of([
        unit({ entities: [{ name: "t", attributes: [{ name: "n", kind: "int", min: 0, max: 1e21 }] }] }),
      ]).wellFormednessErrors(),
    ).toEqual(["unit u1: t.n: bounds must be safe integers"]);
  });

  test("int attributes require bounds", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [
            {
              name: "t",
              attributes: [
                { name: "age", kind: "int" },
                { name: "age", kind: "int", min: 3, max: 1 },
              ],
            },
          ],
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      "unit u1: t.age: int attributes require min and max — the Quint backend needs bounded domains",
      'unit u1: duplicate attribute "t.age"',
      "unit u1: t.age: min > max",
    ]);
  });

  test("an enum literal binds to its sibling ref, not to any enum in the unit", () => {
    const entities = [
      {
        name: "ticket",
        attributes: [
          { name: "status", kind: "enum", values: ["open"] },
          { name: "channel", kind: "enum", values: ["email"] },
          { name: "age", kind: "int", min: 0, max: 1 },
        ],
      },
    ];
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities,
          obligations: [
            {
              id: "DOB-1",
              assert: {
                op: "eq",
                args: [
                  { op: "ref", path: "ticket.status" },
                  { op: "enum", value: "email" },
                ],
              },
            },
            {
              id: "DOB-2",
              assert: {
                op: "eq",
                args: [
                  { op: "ref", path: "ticket.age" },
                  { op: "enum", value: "email" },
                ],
              },
            },
            { id: "DOB-3", assert: { op: "enum", value: "nope" } },
          ],
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      'unit u1: obligation DOB-1: enum literal "email" is not a value of "ticket.status"',
      'unit u1: obligation DOB-2: enum literal "email" is compared against non-enum attribute "ticket.age"',
      'unit u1: obligation DOB-3: enum literal "nope" is not a value of any declared enum attribute',
    ]);
  });

  test("temporal branches are walked in design obligations too", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "flag", kind: "bool" }] }],
          obligations: [
            {
              id: "DOB-1",
              temporal: {
                assert: { op: "ref", path: "t.ghost" },
                from: { op: "ref", path: "t.flag" },
                to: { op: "ref", path: "t.other" },
              },
            },
          ],
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      'unit u1: obligation DOB-1: unresolvable reference "t.ghost"',
      'unit u1: obligation DOB-1: unresolvable reference "t.other"',
    ]);
  });

  test('origin "rules" requires brRefs', () => {
    expect(
      DesignUnitDeclarations.of([unit({ obligations: [{ id: "DOB-1", origin: "rules" }] })]).wellFormednessErrors(),
    ).toEqual(['unit u1: obligation DOB-1: origin "rules" requires brRefs']);
  });

  test("a machine's lifecycle attribute must be a declared enum", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({ stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }] }),
      ]).wellFormednessErrors(),
    ).toEqual(['unit u1: machine SM-1: lifecycle attribute "t.state" is not declared']);
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "bool" }] }],
          stateMachines: [{ id: "SM-1", attrPath: "t.state", initial: [], transitions: [], ignores: [] }],
        }),
      ]).wellFormednessErrors(),
    ).toEqual(['unit u1: machine SM-1: lifecycle attribute "t.state" is not an enum — its values are the state set']);
  });

  test("machine states, self-assignment and ignore collisions", () => {
    const errors = DesignUnitDeclarations.of([
      unit({
        entities: [{ name: "t", attributes: [{ name: "state", kind: "enum", values: ["open", "closed"] }] }],
        stateMachines: [
          {
            id: "SM-1",
            attrPath: "t.state",
            initial: ["ghost"],
            transitions: [
              {
                id: "TR-1",
                from: "open",
                to: "gone",
                trigger: "close",
                guard: { op: "ref", path: "t.state" },
                effect: { op: "ref", path: "t.state", prime: true },
              },
            ],
            ignores: [
              { state: "open", trigger: "close" },
              { state: "ghost", trigger: "x" },
            ],
          },
        ],
      }),
    ]).wellFormednessErrors();
    expect(errors).toEqual([
      'unit u1: machine SM-1: initial state "ghost" is not a value of t.state',
      'unit u1: transition TR-1: to state "gone" is not a value of t.state',
      `unit u1: transition TR-1: the effect assigns the machine's own attribute "t.state" — state' = to is implicit`,
      "unit u1: machine SM-1: ignores (open, close) collides with a declared transition for the same (state, trigger)",
      'unit u1: machine SM-1: ignores state "ghost" is not a value of t.state',
    ]);
  });

  test("scenario bindings and background assertions are checked per unit", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "flag", kind: "bool" }] }],
          scenarios: [
            {
              id: "DSC-1",
              bindings: [
                ["t.flag", 1],
                ["t.ghost", true],
              ],
              hasEvent: false,
              expect: { op: "ref", path: "t.flag", prime: true },
            },
          ],
          background: [{ id: "DBG-1", assert: { op: "ref", path: "t.ghost" } }],
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      'unit u1: scenario DSC-1: binding value 1 does not fit bool attribute "t.flag"',
      'unit u1: scenario DSC-1: binding for unknown attribute "t.ghost"',
      'unit u1: scenario DSC-1: primed reference "t.flag" is only legal in effects and event-scenario expectations',
      'unit u1: background DBG-1: unresolvable reference "t.ghost"',
    ]);
  });

  test("a missing construction directory is an error even with zero brRefs", () => {
    expect(DesignUnitDeclarations.of([unit({ directoryExists: false })]).wellFormednessErrors()).toEqual([
      "unit u1: no construction/u1/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified",
    ]);
  });

  test("brRefs without rules.md cannot be reverse-verified", () => {
    expect(
      DesignUnitDeclarations.of([unit({ obligations: [{ id: "DOB-1", brRefs: ["BR1.1"] }] })]).wellFormednessErrors(),
    ).toEqual([
      "unit u1: brRefs are used but construction/u1/functional-design/rules.md was not found — they cannot be reverse-verified",
    ]);
  });

  test("BR coverage: unknown refs are errors and silent rules are a contract violation", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          obligations: [{ id: "DOB-1", brRefs: ["BR9.9"] }],
          unformalizedTargets: ["BR1.2"],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ]).wellFormednessErrors(),
    ).toEqual([
      'unit u1: brRef "BR9.9" does not exist in rules.md',
      "unit u1: BR coverage: rule BR1.1 in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation",
    ]);
  });

  test("brRefs from transitions and scenarios count toward coverage", () => {
    expect(
      DesignUnitDeclarations.of([
        unit({
          entities: [{ name: "t", attributes: [{ name: "state", kind: "enum", values: ["open"] }] }],
          stateMachines: [
            {
              id: "SM-1",
              attrPath: "t.state",
              initial: ["open"],
              transitions: [{ id: "TR-1", brRefs: ["BR1.1"] }],
              ignores: [],
            },
          ],
          scenarios: [{ id: "DSC-1", bindings: [], hasEvent: false, brRefs: ["BR1.2"] }],
          rulesMarkdown: "- BR1.1\n- BR1.2\n",
        }),
      ]).wellFormednessErrors(),
    ).toEqual([]);
  });
});

describe("design decl collections (first-class operations)", () => {
  test("of/add/iterator/toArray hold insertion order across the decl bundle", () => {
    const values = EnumerationMembers.of(["a"].map((value) => EnumerationMember.of(value))).add(
      EnumerationMember.of("b"),
    );
    expect([...values].map((value) => value.asString())).toEqual(["a", "b"]);
    expect(values.includes("b")).toBe(true);
    expect(values.includes("c")).toBe(false);
    expect(values.toArray().map((value) => value.asString())).toEqual(["a", "b"]);

    const refs = BusinessRuleReferences.of(Array.from(["BR1.1"], (raw) => BusinessRuleReference.of(raw))).add(
      BusinessRuleReference.of("BR1.2"),
    );
    expect([...refs].map((r) => r.asString())).toEqual(["BR1.1", "BR1.2"]);
    expect(refs.toStrings()).toEqual(["BR1.1", "BR1.2"]);

    const initial = InitialStates.of(["open"].map((value) => InitialState.of(value))).add(InitialState.of("closed"));
    expect([...initial].map((value) => value.asString())).toEqual(["open", "closed"]);
    expect(initial.toArray().map((value) => value.asString())).toEqual(["open", "closed"]);

    const unformalized = UnformalizedTargets.of(Array.from(["BR2.1"], (raw) => TargetIdentifier.of(raw))).add(
      TargetIdentifier.of("BR2.2"),
    );
    expect([...unformalized].map((t) => t.asString())).toEqual(["BR2.1", "BR2.2"]);
    expect(unformalized.covers(TargetIdentifier.of("BR2.2"))).toBe(true);
    expect(unformalized.covers(TargetIdentifier.of("BR9.9"))).toBe(false);
    expect(unformalized.toStrings()).toEqual(["BR2.1", "BR2.2"]);

    const bindings = DeclaredBindings.of([
      BindingDeclaration.of(AttributePath.of("t.flag"), DeclaredBindingValue.of(Declaration.of(true))),
    ]).add(BindingDeclaration.of(AttributePath.of("t.n"), DeclaredBindingValue.of(Declaration.of(1))));
    expect([...bindings].map((binding) => [binding.path().asString(), JSON.parse(binding.value().describe())])).toEqual(
      [
        ["t.flag", true],
        ["t.n", 1],
      ],
    );
    expect(bindings.toArray().length).toBe(2);

    const attr = DesignAttributeDeclaration.of({
      name: DesignAttributeName.of("state"),
      kind: AttributeKind.of("enum"),
      values: EnumerationMembers.of(["open"].map((value) => EnumerationMember.of(value))),
    });
    const attrs = DesignAttributeDeclarations.of([]).add(attr);
    expect([...attrs]).toEqual([attr]);
    expect(attrs.toArray()).toEqual([attr]);

    const entity = DesignEntityDeclaration.of({ name: DesignEntityName.of("t"), attributes: attrs });
    const entities = DesignEntityDeclarations.of([]).add(entity);
    expect([...entities]).toEqual([entity]);
    expect(entities.toArray()).toEqual([entity]);

    const ob = DesignObligationDeclaration.of({ id: DesignObligationIdentifier.of("DOB-1") });
    const obs = DesignObligationDeclarations.of([]).add(ob);
    expect([...obs]).toEqual([ob]);
    expect(obs.toArray()).toEqual([ob]);

    const tr = DesignTransitionDeclaration.of({ id: DesignTransitionIdentifier.of("TR-1") });
    const trs = DesignTransitionDeclarations.of([]).add(tr);
    expect([...trs]).toEqual([tr]);
    expect(trs.toArray()).toEqual([tr]);

    const ig = DesignIgnoreDeclaration.of({ state: "open", trigger: TriggerName.of("close") });
    const igs = DesignIgnoreDeclarations.of([]).add(ig);
    expect([...igs]).toEqual([ig]);
    expect(igs.toArray()).toEqual([ig]);

    const sm = DesignMachineDeclaration.of({
      id: DesignMachineIdentifier.of("SM-1"),
      attrPath: "t.state",
      initial,
      transitions: trs,
      ignores: igs,
    });
    const sms = DesignMachineDeclarations.of([]).add(sm);
    expect([...sms]).toEqual([sm]);
    expect(sms.toArray()).toEqual([sm]);

    const sc = DesignScenarioDeclaration.of({ id: DesignScenarioIdentifier.of("DSC-1"), bindings, hasEvent: false });
    const scs = DesignScenarioDeclarations.of([]).add(sc);
    expect([...scs]).toEqual([sc]);
    expect(scs.toArray()).toEqual([sc]);

    const bg = DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1") });
    const bgs = DesignBackgroundDeclarations.of([]).add(bg);
    expect([...bgs]).toEqual([bg]);
    expect(bgs.toArray()).toEqual([bg]);

    const ud = DesignUnitDeclaration.of({
      unit: DesignUnitIdentifier.of("u1"),
      entities,
      obligations: obs,
      stateMachines: sms,
      scenarios: scs,
      background: bgs,
      unformalizedTargets: unformalized,
      directoryExists: true,
      rulesMarkdown: null,
    });
    const uds = DesignUnitDeclarations.of([]).add(ud);
    expect([...uds]).toEqual([ud]);
    expect(uds.toArray()).toEqual([ud]);
  });
});

describe("contract-1 decl collections (first-class operations)", () => {
  test("of/add/iterator/toArray hold declaration order across the Ir bundle", () => {
    const values = EnumerationMembers.of(["a"].map((value) => EnumerationMember.of(value))).add(
      EnumerationMember.of("b"),
    );
    expect([...values].map((value) => value.asString())).toEqual(["a", "b"]);
    expect(values.includes("b")).toBe(true);
    expect(values.includes("z")).toBe(false);
    expect(values.toArray().map((value) => value.asString())).toEqual(["a", "b"]);

    const attr = IntermediateRepresentationAttributeDeclaration.of({
      name: IntermediateRepresentationAttributeName.of("x"),
      kind: AttributeKind.of("bool"),
    });
    const attrs = IntermediateRepresentationAttributeDeclarations.of([]).add(attr);
    expect([...attrs]).toEqual([attr]);
    expect(attrs.toArray()).toEqual([attr]);

    const ent = IntermediateRepresentationEntityDeclaration.of({
      name: IntermediateRepresentationEntityName.of("t"),
      attributes: attrs,
    });
    const ents = IntermediateRepresentationEntityDeclarations.of([]).add(ent);
    expect([...ents]).toEqual([ent]);
    expect(ents.toArray()).toEqual([ent]);

    const ob = IntermediateRepresentationObligationDeclaration.of({ id: ObligationIdentifier.of("OB-1") });
    const obs = IntermediateRepresentationObligationDeclarations.of([]).add(ob);
    expect([...obs]).toEqual([ob]);
    expect(obs.toArray()).toEqual([ob]);

    const pairs = DeclaredBindings.of([
      BindingDeclaration.of(AttributePath.of("t.x"), DeclaredBindingValue.of(Declaration.of(true))),
    ]).add(BindingDeclaration.of(AttributePath.of("t.y"), DeclaredBindingValue.of(Declaration.of(1))));
    expect([...pairs].map((binding) => [binding.path().asString(), JSON.parse(binding.value().describe())])).toEqual([
      ["t.x", true],
      ["t.y", 1],
    ]);
    expect(pairs.toArray().length).toBe(2);

    const sc = IntermediateRepresentationScenarioDeclaration.of({
      id: ScenarioIdentifier.of("SC-1"),
      bindings: pairs,
      hasEvent: false,
    });
    const scs = IntermediateRepresentationScenarioDeclarations.of([]).add(sc);
    expect([...scs]).toEqual([sc]);
    expect(scs.toArray()).toEqual([sc]);

    const bg = IntermediateRepresentationBackgroundDeclaration.of({ id: BackgroundAssumptionIdentifier.of("BG-1") });
    const bgs = IntermediateRepresentationBackgroundDeclarations.of([]).add(bg);
    expect([...bgs]).toEqual([bg]);
    expect(bgs.toArray()).toEqual([bg]);
  });
});

describe("decl name primitives and the shared bound (issue #46 wave 5c-2)", () => {
  test("IntermediateRepresentationEntityName / IntermediateRepresentationAttributeName parse-reject the empty token and rehydrate verbatim", () => {
    expect(IntermediateRepresentationEntityName.parse("").ok).toBe(false);
    const en = IntermediateRepresentationEntityName.parse("order");
    if (!en.ok) throw new Error("unreachable");
    expect(en.value.equals(IntermediateRepresentationEntityName.of("order"))).toBe(true);
    expect(en.value.asString()).toBe("order");

    expect(IntermediateRepresentationAttributeName.parse("").ok).toBe(false);
    const an = IntermediateRepresentationAttributeName.parse("qty");
    if (!an.ok) throw new Error("unreachable");
    expect(an.value.equals(IntermediateRepresentationAttributeName.of("qty"))).toBe(true);
    expect(an.value.asString()).toBe("qty");
  });

  test("AttributeBound owns the range-inversion comparison", () => {
    expect(AttributeBound.of(9).exceeds(AttributeBound.of(1))).toBe(true);
    expect(AttributeBound.of(1).exceeds(AttributeBound.of(1))).toBe(false);
  });
});

describe("materials aggregates and the persistence round-trip (repository ruling)", () => {
  test("ErrorMessages first-class collection", () => {
    const msgs = ErrorMessages.of(["a"].map((value) => ErrorMessage.of(value))).add(ErrorMessage.of("b"));
    expect([...msgs].map((value) => value.asString())).toEqual(["a", "b"]);
    expect(msgs.isEmpty()).toBe(false);
    expect(ErrorMessages.of([]).isEmpty()).toBe(true);
    expect(msgs.toArray().map((value) => value.asString())).toEqual(["a", "b"]);
  });

  test("IntermediateRepresentationValidationMaterialsIdentifier / DesignIntermediateRepresentationValidationMaterialsIdentifier anchor 1:1 to the model id", () => {
    const rid = IntermediateRepresentationValidationMaterialsIdentifier.of(FormalModelIdentifier.of(ap("/r/x.md")));
    expect(
      rid.equals(IntermediateRepresentationValidationMaterialsIdentifier.of(FormalModelIdentifier.of(ap("/r/x.md")))),
    ).toBe(true);
    expect(rid.modelId().artifactPath().asString()).toBe("/r/x.md");
    const did = DesignIntermediateRepresentationValidationMaterialsIdentifier.of(
      DesignModelIdentifier.of(ap("/r/y.md")),
    );
    expect(
      did.equals(
        DesignIntermediateRepresentationValidationMaterialsIdentifier.of(DesignModelIdentifier.of(ap("/r/y.md"))),
      ),
    ).toBe(true);
    expect(did.modelId().artifactPath().asString()).toBe("/r/y.md");
  });

  test("findById∘store round-trips the source document byte-for-byte (both contracts)", () => {
    const record = join(tmpdir(), `deep-spec-store-${Math.random().toString(36).slice(2)}`);
    const stage = join(record, "construction", "deep-spec-analysis-verify");
    mkdirSync(stage, { recursive: true });
    const irDoc = '# model\n\n```json\n{"irVersion":"1.0.0","entities":[],"obligations":[],"scenarios":[]}\n```\n';
    const modelPath = join(stage, "deep-spec-analysis-formal-model.md");
    writeFileSync(modelPath, irDoc);
    const repo = new IntermediateRepresentationValidationMaterialsRepositoryImplementation({
      schemaPath: irSchemaPath,
    });
    const found = repo.findById(
      IntermediateRepresentationValidationMaterialsIdentifier.of(FormalModelIdentifier.of(ap(modelPath))),
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(Buffer.from(found.value.sourceDocument()).toString("utf-8")).toBe(irDoc);
    rmSync(modelPath);
    const stored = repo.store(found.value);
    expect(stored.ok).toBe(true);
    expect(readFileSync(modelPath, "utf-8")).toBe(irDoc);
    const assessment = found.value.validate({
      complete: (assessment) => assessment,
      sourceRequired: () => {
        throw new Error("schema-invalid materials must not request requirements.md");
      },
    });
    expect([...assessment.errors()].map((message) => message.asString())).toEqual([
      ': missing required property "schema"',
      ': missing required property "background"',
      ': unexpected property "entities"',
    ]);

    // design 側も同じ往復則。
    const dDoc = '# design\n\n```json\n{"irVersion":"1.0.0","units":[]}\n```\n';
    const dPath = join(stage, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(dPath, dDoc);
    const dRepo = new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({
      schemaPath: designSchemaPath,
    });
    const dId = DesignIntermediateRepresentationValidationMaterialsIdentifier.of(DesignModelIdentifier.of(ap(dPath)));
    const dFound = dRepo.findById(dId);
    expect(dFound.ok).toBe(true);
    if (!dFound.ok) return;
    expect(dFound.value.id().equals(dId)).toBe(true);
    expect(Buffer.from(dFound.value.sourceDocument()).toString("utf-8")).toBe(dDoc);
    rmSync(dPath);
    expect(dRepo.store(dFound.value).ok).toBe(true);
    expect(readFileSync(dPath, "utf-8")).toBe(dDoc);
    rmSync(record, { recursive: true, force: true });
  });

  test("FunctionalRequirementReferenceClaims first-class collection feeds the reverse index", () => {
    const claims = FunctionalRequirementReferenceClaims.of([]).add(
      FunctionalRequirementReferenceClaim.of(
        "OB-1",
        FunctionalRequirementReferences.of(Array.from(["FR-1"], (raw) => RequirementIdentifier.of(raw))),
      ),
    );
    expect([...claims].length).toBe(1);
    const owners = new Map<string, FunctionalRequirementReferenceClaim[]>();
    claims.toArray()[0]?.claimInto(owners);
    expect([...owners].map(([id, list]) => [id, list.map((claim) => claim.ownerDescription())])).toEqual([
      ["FR-1", ["OB-1"]],
    ]);
  });
});

describe("repository read failures keep the Result contract (PR#58 review)", () => {
  test("a directory squatting on the artifact path classifies as io-failed, not a crash", () => {
    const record = join(tmpdir(), `deep-spec-iofail-${Math.random().toString(36).slice(2)}`);
    const stage = join(record, "construction", "deep-spec-analysis-verify");
    // 成果物名のディレクトリ: existsSync は真だが readFileSync は EISDIR。
    mkdirSync(join(stage, "deep-spec-analysis-formal-model.md"), { recursive: true });
    const found = new IntermediateRepresentationValidationMaterialsRepositoryImplementation({
      schemaPath: irSchemaPath,
    }).findById(
      IntermediateRepresentationValidationMaterialsIdentifier.of(
        FormalModelIdentifier.of(ap(join(stage, "deep-spec-analysis-formal-model.md"))),
      ),
    );
    expect(!found.ok && found.error.kind).toBe("io-failed");

    mkdirSync(join(stage, "deep-spec-analysis-functional-formal-model.md"), { recursive: true });
    const dFound = new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({
      schemaPath: designSchemaPath,
    }).findById(
      DesignIntermediateRepresentationValidationMaterialsIdentifier.of(
        DesignModelIdentifier.of(ap(join(stage, "deep-spec-analysis-functional-formal-model.md"))),
      ),
    );
    expect(!dFound.ok && dFound.error.kind).toBe("io-failed");
    rmSync(record, { recursive: true, force: true });
  });

  test("a directory squatting on requirements.md classifies as io-failed", () => {
    const record = join(tmpdir(), `deep-spec-src-iofail-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(record, "inception", "requirements-analysis", "requirements.md"), { recursive: true });
    const source = new RequirementsSourceRepositoryImplementation().findById(
      RequirementsSourceIdentifier.of(ap(record)),
    );
    expect(!source.ok && source.error.kind).toBe("io-failed");
    rmSync(record, { recursive: true, force: true });
  });
});

describe("store faces on the workflow-authored aggregates (owner ruling: writable where writing is definable)", () => {
  test("formal/design model repositories round-trip the source document", () => {
    const record = join(tmpdir(), `deep-spec-model-store-${Math.random().toString(36).slice(2)}`);
    mkdirSync(record, { recursive: true });
    const doc = '# m\n\n```json\n{"irVersion":"1.0.0","schema":{"entities":[]},"obligations":[],"scenarios":[]}\n```\n';
    const mPath = join(record, "deep-spec-analysis-formal-model.md");
    writeFileSync(mPath, doc);
    const repo = new FormalModelRepositoryImplementation();
    const found = repo.findById(FormalModelIdentifier.of(ap(mPath)));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(Buffer.from(found.value.sourceDocument()).toString("utf-8")).toBe(doc);
    rmSync(mPath);
    expect(repo.store(found.value).ok).toBe(true);
    expect(readFileSync(mPath, "utf-8")).toBe(doc);

    // 実 fixture の設計 IR を往復させる（合成文書はパーサの構造要件に届かない）。
    const dDoc = readFileSync(
      join(
        pluginRoot,
        "tests",
        "fixtures",
        "design",
        "record",
        "construction",
        "deep-spec-analysis-functional-verify",
        "deep-spec-analysis-functional-formal-model.md",
      ),
      "utf-8",
    );
    const dPath = join(record, "deep-spec-analysis-functional-formal-model.md");
    writeFileSync(dPath, dDoc);
    const dRepo = new DesignModelRepositoryImplementation();
    const dFound = dRepo.findById(DesignModelIdentifier.of(ap(dPath)));
    expect(dFound.ok).toBe(true);
    if (!dFound.ok) return;
    rmSync(dPath);
    expect(dRepo.store(dFound.value).ok).toBe(true);
    expect(readFileSync(dPath, "utf-8")).toBe(dDoc);
    rmSync(record, { recursive: true, force: true });
  });

  test("requirements source repository round-trips the source bytes at the resolved location", () => {
    const record = join(tmpdir(), `deep-spec-src-store-${Math.random().toString(36).slice(2)}`);
    const srcPath = join(record, "inception", "requirements-analysis", "requirements.md");
    mkdirSync(dirname(srcPath), { recursive: true });
    writeFileSync(srcPath, "- FR-1: x\n");
    const repo = new RequirementsSourceRepositoryImplementation();
    const found = repo.findById(RequirementsSourceIdentifier.of(ap(record)));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.sourcePath().asString()).toBe(srcPath);
    rmSync(srcPath);
    expect(repo.store(found.value).ok).toBe(true);
    expect(readFileSync(srcPath, "utf-8")).toBe("- FR-1: x\n");
    rmSync(record, { recursive: true, force: true });
  });
});

describe("byte-fidelity and mutation safety of the store faces (PR#58 review)", () => {
  test("non-UTF-8 bytes outside the fence survive the round-trip byte-for-byte", () => {
    const record = join(tmpdir(), `deep-spec-rawbytes-${Math.random().toString(36).slice(2)}`);
    const stage = join(record, "construction", "deep-spec-analysis-verify");
    mkdirSync(stage, { recursive: true });
    const head = Buffer.from("# m \xff\xfe raw\n\n```json\n", "latin1");
    const fence = Buffer.from('{"irVersion":"1.0.0","entities":[],"obligations":[],"scenarios":[]}\n```\n', "utf-8");
    const raw = Buffer.concat([head, fence]);
    const modelPath = join(stage, "deep-spec-analysis-formal-model.md");
    writeFileSync(modelPath, raw);
    const repo = new IntermediateRepresentationValidationMaterialsRepositoryImplementation({
      schemaPath: irSchemaPath,
    });
    const found = repo.findById(
      IntermediateRepresentationValidationMaterialsIdentifier.of(FormalModelIdentifier.of(ap(modelPath))),
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    rmSync(modelPath);
    expect(repo.store(found.value).ok).toBe(true);
    expect(Buffer.from(readFileSync(modelPath)).equals(raw)).toBe(true);
    rmSync(record, { recursive: true, force: true });
  });

  test("mutating the returned byte view cannot corrupt what store writes", () => {
    const record = join(tmpdir(), `deep-spec-mut-${Math.random().toString(36).slice(2)}`);
    const srcPath = join(record, "inception", "requirements-analysis", "requirements.md");
    mkdirSync(dirname(srcPath), { recursive: true });
    writeFileSync(srcPath, "- FR-1: x\n");
    const repo = new RequirementsSourceRepositoryImplementation();
    const found = repo.findById(RequirementsSourceIdentifier.of(ap(record)));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.id().equals(RequirementsSourceIdentifier.of(ap(record)))).toBe(true);
    expect(found.value.digest().asString().length).toBe(64);
    const view = found.value.sourceDocument();
    view.fill(0);
    expect(repo.store(found.value).ok).toBe(true);
    expect(readFileSync(srcPath, "utf-8")).toBe("- FR-1: x\n");
    rmSync(record, { recursive: true, force: true });
  });
});

describe("unreadable-artifact degradation pins (thaw #38 item 3 — resolved by a858abc)", () => {
  test("a model path that exists but cannot be read degrades to a failed verdict, never a crash", () => {
    // ディレクトリを model パスに与える——existsSync は通り readFileSync が
    // EISDIR で落ちる（権限エラー・TOCTOU レースの決定論的な代役）。
    const scratch = mkdtempSync(join(tmpdir(), "unreadable-model-"));
    const irDir = join(scratch, "deep-spec-analysis-formal-model.md");
    const designDir = join(scratch, "deep-spec-analysis-functional-formal-model.md");
    mkdirSync(irDir);
    mkdirSync(designDir);
    try {
      const ir = irUseCase().execute(FormalModelIdentifier.of(ap(irDir)));
      expect(ir.kind).toBe("acquisition-failed");
      if (ir.kind === "acquisition-failed") {
        expect("cause" in ir.error && ir.error.cause).toContain("EISDIR");
      }
      const design = designUseCase().execute(DesignModelIdentifier.of(ap(designDir)));
      expect(design.kind).toBe("acquisition-failed");
      if (design.kind === "acquisition-failed") {
        expect("cause" in design.error && design.error.cause).toContain("EISDIR");
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
