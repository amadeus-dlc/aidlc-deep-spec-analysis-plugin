// requirements/domain の equals / hashCode の対の契約テスト。
//
// 表明するのは 2 つの契約:
//   1. 等しい値は必ず等しいハッシュを返す（逆は要求しない——衝突は許される）
//   2. ハッシュは決定的——同じ値から何度呼んでも同じ
// これに加えて「equals がどのフィールドを見ているか」をフィールド単位で表明する。
// 1 フィールドだけ変えた相手と等しくないことが、hashCode が正しいフィールド集合
// から畳み込まれているかの実質的な検査になる。

import { describe, expect, test } from "bun:test";
import {
  ArtifactPath,
  AttributeBound,
  AttributeKind,
  AttributePath,
  BackendName,
  BindingDeclaration,
  BindingValue,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  DeclaredBound,
  EnumerationMember,
  EnumerationMembers,
  type Expression,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  IntermediateRepresentationVersion,
  ObligationNature,
  QueryLabel,
  RequirementIdentifier,
  ScenarioBinding,
  ScenarioBindings,
  ScenarioExpectation,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import type { Json } from "@deep-spec-analysis/kernel-infrastructure";
import {
  BackgroundAssumption,
  BackgroundAssumptionIdentifier,
  CrossCheckedEntries,
  CrossCheckedEntry,
  FormalModelIdentifier,
  FunctionalRequirementReferenceClaim,
  FunctionalRequirementReferenceIndex,
  IntermediateRepresentationAttributeCatalog,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationAttributeEntry,
  IntermediateRepresentationAttributeName,
  IntermediateRepresentationBackgroundDeclaration,
  IntermediateRepresentationEntityDeclaration,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationEntityName,
  IntermediateRepresentationObligationDeclaration,
  IntermediateRepresentationScenarioDeclaration,
  IntermediateRepresentationTemporalDeclaration,
  IntermediateRepresentationValidationMaterialsIdentifier,
  Obligation,
  ObligationIdentifier,
  QuintMachineComponent,
  QuintMachineComponents,
  RequirementAttributeDeclaration,
  RequirementsSourceIdentifier,
  SatisfiabilityModuloTheoriesEventPairProbe,
  SatisfiabilityModuloTheoriesQueryVerdict,
  SatisfiabilityModuloTheoriesQueryVerdictEntry,
  Scenario,
  ScenarioIdentifier,
  Scenarios,
  TraceState,
  TraceStateEntry,
  TraceValue,
  VerificationFinding,
  VerificationFindings,
  VerificationReport,
  VerificationReportIdentifier,
  VerificationReports,
  VerificationSkipped,
  VerificationSkips,
  VerificationWitness,
} from "@deep-spec-analysis/requirements-domain";

type ValueWithEquality<T> = { equals(other: T): boolean; hashCode(): number };

/**
 * equals と hashCode の対の契約を表明する。
 *
 * `same` は base と同じ材料から別に組んだ値——equals で等しく、ハッシュも一致し、
 * 何度呼んでも変わらないことを見る。`distinctByField` は「equals が見ている
 * フィールドを 1 つだけ変えた相手」で、どれとも等しくないことを表明する。
 * 等しくない相手のハッシュは要求しない（衝突は許される）。
 */
function assertEqualityContract<T extends ValueWithEquality<T>>(
  base: T,
  same: T,
  distinctByField: readonly (readonly [field: string, other: T])[],
): void {
  expect(base.equals(same)).toBe(true);
  expect(same.equals(base)).toBe(true);
  // 等しい値は必ず等しいハッシュ（逆は要求しない——衝突は許される）。
  expect(base.hashCode()).toBe(same.hashCode());
  // 同じ値から何度呼んでも同じ（決定的）。
  expect(base.hashCode()).toBe(base.hashCode());
  for (const [field, other] of distinctByField) {
    // 失敗時にどのフィールドで崩れたか読めるよう、ラベルごと表明する。
    expect([field, base.equals(other)]).toEqual([field, false]);
    expect([field, other.equals(base)]).toEqual([field, false]);
  }
}

const lit = (value: boolean): Expression => ({ op: "lit", value });
const ref = (path: string): Expression => ({ op: "ref", path });

function declaredBindings(entries: readonly (readonly [string, Json])[]): DeclaredBindings {
  return DeclaredBindings.of(
    entries.map(([path, value]) =>
      BindingDeclaration.of(AttributePath.of(path), DeclaredBindingValue.of(Declaration.of(value))),
    ),
  );
}

function traceState(entries: readonly (readonly [string, boolean | number | string])[]): TraceState {
  return TraceState.of(
    entries.map(([path, value]) => TraceStateEntry.of(AttributePath.of(path), TraceValue.of(value))),
  );
}

function requirementReferences(...raw: readonly string[]): FunctionalRequirementReferences {
  return FunctionalRequirementReferences.of(raw.map((id) => RequirementIdentifier.of(id)));
}

function enumerationMembers(...raw: readonly string[]): EnumerationMembers {
  return EnumerationMembers.of(raw.map((value) => EnumerationMember.of(value)));
}

function attributeDeclaration(name: string, kind: string): IntermediateRepresentationAttributeDeclaration {
  return IntermediateRepresentationAttributeDeclaration.of({
    name: IntermediateRepresentationAttributeName.of(name),
    kind: AttributeKind.of(kind),
  });
}

function scenarioBindings(values: Readonly<Record<string, boolean | number | string>>): ScenarioBindings {
  return ScenarioBindings.of(
    Object.entries(values).map(([path, value]) => ScenarioBinding.of(AttributePath.of(path), BindingValue.of(value))),
  );
}

function scenario(
  overrides: {
    id?: string;
    expectation?: "accept" | "reject";
    functionalRequirementReferences?: FunctionalRequirementReferences;
    bindings?: ScenarioBindings;
    event?: { readonly trigger: TriggerName };
    expect?: Expression;
  } = {},
): Scenario {
  return Scenario.of({
    id: ScenarioIdentifier.of(overrides.id ?? "SC-1"),
    expectation: ScenarioExpectation.of(overrides.expectation ?? "accept"),
    functionalRequirementReferences: overrides.functionalRequirementReferences ?? requirementReferences("FR-1"),
    bindings: overrides.bindings ?? scenarioBindings({ "Order.status": "open" }),
    event: "event" in overrides ? overrides.event : { trigger: TriggerName.of("submit") },
    expect: "expect" in overrides ? overrides.expect : lit(true),
  });
}

function verificationFindingsWith(detail: string): VerificationFindings {
  return VerificationFindings.of([
    VerificationFinding.of({
      kind: FindingKind.conflict(),
      functionalRequirementReferences: requirementReferences("FR-1"),
      targets: FindingTargets.of(TargetIdentifier.of("OB-1"), []),
      witness: VerificationWitness.core(["g1"]),
      detail,
    }),
  ]);
}

function verificationSkipsFor(target: string): VerificationSkips {
  return VerificationSkips.of([
    VerificationSkipped.of({ target: TargetIdentifier.of(target), reason: SkipReason.capability() }),
  ]);
}

function crossCheckedEntries(backend: string): CrossCheckedEntries {
  return CrossCheckedEntries.of([
    CrossCheckedEntry.of({
      backend: BackendName.of(backend),
      targets: TargetIdentifiers.of([TargetIdentifier.of("SC-1")]),
    }),
  ]);
}

// crossChecked と unavailableReason は `T | null`（非 optional）を持つので、
// 「未指定なら既定値、null 明示なら不在」を区別するのに `?? 既定値` は使えない
// （null が既定値へすり替わってしまう）。undefined 判定で明示的に分岐する。
function verificationReport(
  overrides: {
    id?: VerificationReportIdentifier;
    irVersion?: string;
    irHash?: string;
    method?: string;
    findings?: VerificationFindings;
    skipped?: VerificationSkips;
    crossChecked?: CrossCheckedEntries | null;
    unavailableReason?: string | null;
  } = {},
): VerificationReport {
  return VerificationReport.of({
    id: overrides.id ?? VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "smt"),
    irVersion: IntermediateRepresentationVersion.of(overrides.irVersion ?? "1.0.0"),
    irHash: ContentHash.ofText(overrides.irHash ?? "model"),
    method: VerificationMethod.of(overrides.method ?? "exhaustive"),
    findings: overrides.findings ?? verificationFindingsWith("guards overlap but effects contradict"),
    skipped: overrides.skipped ?? verificationSkipsFor("OB-2"),
    crossChecked: overrides.crossChecked === undefined ? crossCheckedEntries("smt") : overrides.crossChecked,
    unavailableReason: overrides.unavailableReason === undefined ? null : overrides.unavailableReason,
  });
}

describe("識別子の等価性とハッシュ", () => {
  test("BackgroundAssumptionIdentifier は id 文字列で同定する", () => {
    assertEqualityContract(BackgroundAssumptionIdentifier.of("BG-1"), BackgroundAssumptionIdentifier.of("BG-1"), [
      ["value", BackgroundAssumptionIdentifier.of("BG-2")],
    ]);
  });

  test("ObligationIdentifier は id 文字列で同定する", () => {
    assertEqualityContract(ObligationIdentifier.of("OB-1"), ObligationIdentifier.of("OB-1"), [
      ["value", ObligationIdentifier.of("OB-2")],
    ]);
  });

  test("ScenarioIdentifier は id 文字列で同定する", () => {
    assertEqualityContract(ScenarioIdentifier.of("SC-1"), ScenarioIdentifier.of("SC-1"), [
      ["value", ScenarioIdentifier.of("SC-2")],
    ]);
  });

  test("IntermediateRepresentationAttributeName は名前文字列で同定する", () => {
    assertEqualityContract(
      IntermediateRepresentationAttributeName.of("status"),
      IntermediateRepresentationAttributeName.of("status"),
      [["value", IntermediateRepresentationAttributeName.of("state")]],
    );
  });

  test("IntermediateRepresentationEntityName は名前文字列で同定する", () => {
    assertEqualityContract(
      IntermediateRepresentationEntityName.of("Order"),
      IntermediateRepresentationEntityName.of("Order"),
      [["value", IntermediateRepresentationEntityName.of("Invoice")]],
    );
  });

  test("FormalModelIdentifier は成果物パスで同定する", () => {
    assertEqualityContract(
      FormalModelIdentifier.of(ArtifactPath.of("deep-spec/model.ir.json")),
      FormalModelIdentifier.of(ArtifactPath.of("deep-spec/model.ir.json")),
      [["path", FormalModelIdentifier.of(ArtifactPath.of("deep-spec/other.ir.json"))]],
    );
  });

  test("RequirementsSourceIdentifier は記録ルートのパスで同定する", () => {
    assertEqualityContract(
      RequirementsSourceIdentifier.of(ArtifactPath.of("aidlc/intents/a-1")),
      RequirementsSourceIdentifier.of(ArtifactPath.of("aidlc/intents/a-1")),
      [["recordRoot", RequirementsSourceIdentifier.of(ArtifactPath.of("aidlc/intents/b-2"))]],
    );
  });

  test("IntermediateRepresentationValidationMaterialsIdentifier は形式モデルの恒等をそのまま運ぶ", () => {
    const model = FormalModelIdentifier.of(ArtifactPath.of("deep-spec/model.ir.json"));
    const otherModel = FormalModelIdentifier.of(ArtifactPath.of("deep-spec/other.ir.json"));
    assertEqualityContract(
      IntermediateRepresentationValidationMaterialsIdentifier.of(model),
      IntermediateRepresentationValidationMaterialsIdentifier.of(
        FormalModelIdentifier.of(ArtifactPath.of("deep-spec/model.ir.json")),
      ),
      [["model", IntermediateRepresentationValidationMaterialsIdentifier.of(otherModel)]],
    );
  });

  test("VerificationReportIdentifier は配置ディレクトリと backend 名の両方を見る", () => {
    assertEqualityContract(
      VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "smt"),
      VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "smt"),
      [
        ["directory", VerificationReportIdentifier.of(ArtifactPath.of("other-verify"), "smt")],
        ["backend", VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "quint")],
      ],
    );
  });
});

describe("索引項目と主張の等価性とハッシュ", () => {
  test("FunctionalRequirementReferenceClaim は owner と参照列の両方を見る", () => {
    assertEqualityContract(
      FunctionalRequirementReferenceClaim.of("obligation OB-1", requirementReferences("FR-1", "FR-2")),
      FunctionalRequirementReferenceClaim.of("obligation OB-1", requirementReferences("FR-1", "FR-2")),
      [
        ["owner", FunctionalRequirementReferenceClaim.of("obligation OB-2", requirementReferences("FR-1", "FR-2"))],
        [
          "functionalRequirementReferences",
          FunctionalRequirementReferenceClaim.of("obligation OB-1", requirementReferences("FR-1")),
        ],
      ],
    );
  });

  test("IntermediateRepresentationAttributeEntry は owner と属性宣言の両方を見る", () => {
    const owner = IntermediateRepresentationEntityName.of("Order");
    const entry = (ownerName: string, kind: string): IntermediateRepresentationAttributeEntry =>
      IntermediateRepresentationAttributeEntry.of(
        IntermediateRepresentationEntityName.of(ownerName),
        attributeDeclaration("status", kind),
      );
    // owner を変えると座標も動くが、種別だけを変えた相手は座標が同じ——
    // それでも等しくないことが、宣言そのものを見ている証拠になる。
    assertEqualityContract(
      IntermediateRepresentationAttributeEntry.of(owner, attributeDeclaration("status", "enum")),
      entry("Order", "enum"),
      [
        ["owner", entry("Invoice", "enum")],
        ["attribute", entry("Order", "bool")],
      ],
    );
    expect(entry("Order", "enum").path().asString()).toBe(entry("Order", "bool").path().asString());
  });

  test("TraceStateEntry は属性パスと値の両方を見る", () => {
    assertEqualityContract(
      TraceStateEntry.of(AttributePath.of("Order.status"), TraceValue.of("open")),
      TraceStateEntry.of(AttributePath.of("Order.status"), TraceValue.of("open")),
      [
        ["path", TraceStateEntry.of(AttributePath.of("Order.state"), TraceValue.of("open"))],
        ["value", TraceStateEntry.of(AttributePath.of("Order.status"), TraceValue.of("closed"))],
      ],
    );
  });

  test("SatisfiabilityModuloTheoriesQueryVerdictEntry はクエリと判定の両方を見る", () => {
    const verdict = (status: "sat" | "unsat"): SatisfiabilityModuloTheoriesQueryVerdict =>
      SatisfiabilityModuloTheoriesQueryVerdict.of({ status });
    assertEqualityContract(
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(QueryLabel.of("q-overlap"), verdict("sat")),
      SatisfiabilityModuloTheoriesQueryVerdictEntry.of(QueryLabel.of("q-overlap"), verdict("sat")),
      [
        ["query", SatisfiabilityModuloTheoriesQueryVerdictEntry.of(QueryLabel.of("q-joint"), verdict("sat"))],
        ["verdict", SatisfiabilityModuloTheoriesQueryVerdictEntry.of(QueryLabel.of("q-overlap"), verdict("unsat"))],
      ],
    );
  });
});

describe("IR 宣言の等価性とハッシュ", () => {
  test("BackgroundAssumption は id と表明の両方を見る", () => {
    const assumption = (id: string, assertion: Expression): BackgroundAssumption =>
      BackgroundAssumption.of({ id: BackgroundAssumptionIdentifier.of(id), assert: assertion });
    assertEqualityContract(assumption("BG-1", ref("Order.status")), assumption("BG-1", ref("Order.status")), [
      ["id", assumption("BG-2", ref("Order.status"))],
      ["assert", assumption("BG-1", ref("Order.state"))],
    ]);
  });

  test("IntermediateRepresentationBackgroundDeclaration は id と省略可能な表明を見る", () => {
    const declaration = (id: string, assertion?: Expression): IntermediateRepresentationBackgroundDeclaration =>
      IntermediateRepresentationBackgroundDeclaration.of({
        id: BackgroundAssumptionIdentifier.of(id),
        assert: assertion,
      });
    assertEqualityContract(declaration("BG-1", ref("Order.status")), declaration("BG-1", ref("Order.status")), [
      ["id", declaration("BG-2", ref("Order.status"))],
      ["assert", declaration("BG-1", ref("Order.state"))],
      ["assert（不在）", declaration("BG-1")],
    ]);
    // 表明が無い宣言どうしも、不在という同じ状態として等しい。
    assertEqualityContract(declaration("BG-1"), declaration("BG-1"), [["id", declaration("BG-2")]]);
  });

  test("IntermediateRepresentationTemporalDeclaration は assert・from・to をそれぞれ見る", () => {
    const temporal = (
      assertion?: Expression,
      from?: Expression,
      to?: Expression,
    ): IntermediateRepresentationTemporalDeclaration =>
      IntermediateRepresentationTemporalDeclaration.of({ assert: assertion, from, to });
    assertEqualityContract(
      temporal(ref("Order.status"), ref("Order.opened"), ref("Order.closed")),
      temporal(ref("Order.status"), ref("Order.opened"), ref("Order.closed")),
      [
        ["assert", temporal(ref("Order.state"), ref("Order.opened"), ref("Order.closed"))],
        ["from", temporal(ref("Order.status"), ref("Order.paid"), ref("Order.closed"))],
        ["to", temporal(ref("Order.status"), ref("Order.opened"), ref("Order.void"))],
        ["from（不在）", temporal(ref("Order.status"), undefined, ref("Order.closed"))],
      ],
    );
  });

  test("IntermediateRepresentationAttributeDeclaration は名前・種別・enum 値・上下限を見る", () => {
    const bounded = (name: string, kind: string, min?: number, max?: number) =>
      IntermediateRepresentationAttributeDeclaration.of({
        name: IntermediateRepresentationAttributeName.of(name),
        kind: AttributeKind.of(kind),
        min: min === undefined ? undefined : DeclaredBound.of(min),
        max: max === undefined ? undefined : DeclaredBound.of(max),
      });
    assertEqualityContract(bounded("amount", "int", 0, 10), bounded("amount", "int", 0, 10), [
      ["name", bounded("total", "int", 0, 10)],
      ["kind", bounded("amount", "enum", 0, 10)],
      ["min", bounded("amount", "int", 1, 10)],
      ["max", bounded("amount", "int", 0, 11)],
      ["min（不在）", bounded("amount", "int", undefined, 10)],
    ]);

    const enumerated = (values?: EnumerationMembers) =>
      IntermediateRepresentationAttributeDeclaration.of({
        name: IntermediateRepresentationAttributeName.of("status"),
        kind: AttributeKind.of("enum"),
        values,
      });
    assertEqualityContract(
      enumerated(enumerationMembers("open", "closed")),
      enumerated(enumerationMembers("open", "closed")),
      [
        ["values", enumerated(enumerationMembers("open", "void"))],
        ["values（不在）", enumerated()],
      ],
    );

    // NaN の上下限は「不適合な数値の宣言も診断対象として有効」の帰結として届く。
    // 生の `===` で比べていたころは、宣言が自身と等しくならなかった。
    const nanBounded = bounded("amount", "int", Number.NaN, Number.NaN);
    expect(nanBounded.equals(nanBounded)).toBe(true);
    expect(nanBounded.equals(bounded("amount", "int", Number.NaN, Number.NaN))).toBe(true);
    expect(nanBounded.hashCode()).toBe(bounded("amount", "int", Number.NaN, Number.NaN).hashCode());
    expect(nanBounded.equals(bounded("amount", "int", 0, Number.NaN))).toBe(false);
    expect(nanBounded.equals(bounded("amount", "int", undefined, Number.NaN))).toBe(false);
  });

  test("RequirementAttributeDeclaration はパス・種別・上下限・enum 値を見る", () => {
    const bounded = (path: string, kind: "bool" | "int" | "enum", min?: number, max?: number) =>
      RequirementAttributeDeclaration.of({
        path: AttributePath.of(path),
        kind,
        min: min === undefined ? undefined : AttributeBound.of(min),
        max: max === undefined ? undefined : AttributeBound.of(max),
      });
    assertEqualityContract(bounded("Order.amount", "int", 0, 10), bounded("Order.amount", "int", 0, 10), [
      ["path", bounded("Order.total", "int", 0, 10)],
      ["kind", bounded("Order.amount", "bool", 0, 10)],
      ["min", bounded("Order.amount", "int", 1, 10)],
      ["max", bounded("Order.amount", "int", 0, 11)],
      ["max（不在）", bounded("Order.amount", "int", 0)],
    ]);

    const enumerated = (values?: EnumerationMembers) =>
      RequirementAttributeDeclaration.of({ path: AttributePath.of("Order.status"), kind: "enum", values });
    assertEqualityContract(
      enumerated(enumerationMembers("open", "closed")),
      enumerated(enumerationMembers("open", "closed")),
      [
        ["values", enumerated(enumerationMembers("open", "void"))],
        ["values（不在）", enumerated()],
      ],
    );
  });

  test("IntermediateRepresentationEntityDeclaration は名前と属性宣言列の両方を見る", () => {
    const entity = (name: string, attributes: readonly IntermediateRepresentationAttributeDeclaration[]) =>
      IntermediateRepresentationEntityDeclaration.of({
        name: IntermediateRepresentationEntityName.of(name),
        attributes: IntermediateRepresentationAttributeDeclarations.of(attributes),
      });
    const status = attributeDeclaration("status", "enum");
    assertEqualityContract(entity("Order", [status]), entity("Order", [attributeDeclaration("status", "enum")]), [
      ["name", entity("Invoice", [status])],
      ["attributes", entity("Order", [attributeDeclaration("status", "bool")])],
    ]);
  });

  test("IntermediateRepresentationObligationDeclaration は id・3 つの式・時相宣言を見る", () => {
    const temporal = (from: string) =>
      IntermediateRepresentationTemporalDeclaration.of({ from: ref(from), to: ref("Order.closed") });
    const declaration = (
      overrides: {
        id?: string;
        assert?: Expression;
        guard?: Expression;
        effect?: Expression;
        temporal?: IntermediateRepresentationTemporalDeclaration;
      } = {},
    ) =>
      IntermediateRepresentationObligationDeclaration.of({
        id: ObligationIdentifier.of(overrides.id ?? "OB-1"),
        assert: "assert" in overrides ? overrides.assert : ref("Order.status"),
        guard: "guard" in overrides ? overrides.guard : ref("Order.paid"),
        effect: "effect" in overrides ? overrides.effect : ref("Order.shipped"),
        temporal: "temporal" in overrides ? overrides.temporal : temporal("Order.opened"),
      });
    assertEqualityContract(declaration(), declaration(), [
      ["id", declaration({ id: "OB-2" })],
      ["assert", declaration({ assert: ref("Order.state") })],
      ["assert（不在）", declaration({ assert: undefined })],
      ["guard", declaration({ guard: ref("Order.unpaid") })],
      ["effect", declaration({ effect: ref("Order.held") })],
      ["temporal", declaration({ temporal: temporal("Order.reopened") })],
      ["temporal（不在）", declaration({ temporal: undefined })],
    ]);
  });

  test("IntermediateRepresentationScenarioDeclaration は id・束縛・event 有無・期待を見る", () => {
    const declaration = (
      overrides: { id?: string; bindings?: DeclaredBindings; hasEvent?: boolean; expect?: Expression } = {},
    ) =>
      IntermediateRepresentationScenarioDeclaration.of({
        id: ScenarioIdentifier.of(overrides.id ?? "SC-1"),
        bindings: overrides.bindings ?? declaredBindings([["Order.status", "open"]]),
        hasEvent: overrides.hasEvent ?? true,
        expect: "expect" in overrides ? overrides.expect : lit(true),
      });
    assertEqualityContract(declaration(), declaration(), [
      ["id", declaration({ id: "SC-2" })],
      ["bindings", declaration({ bindings: declaredBindings([["Order.status", "closed"]]) })],
      ["hasEvent", declaration({ hasEvent: false })],
      ["expect", declaration({ expect: lit(false) })],
      ["expect（不在）", declaration({ expect: undefined })],
    ]);
  });

  test("IntermediateRepresentationScenarioDeclaration の束縛比較は逐語——JSON のキー順まで一致を要求する", () => {
    const ascending = declaredBindings([["Order.window", { from: 1, to: 2 }]]);
    const descending = declaredBindings([["Order.window", { to: 2, from: 1 }]]);
    // 要素自身の equals（Declaration の jsonEquals）はキー順を無視するので等しい。
    expect(ascending.equals(descending)).toBe(true);
    // 宣言の equals は matchesVerbatim を使う——キー順が違えば等しくない。
    expect(ascending.matchesVerbatim(descending)).toBe(false);
    const declaration = (bindings: DeclaredBindings) =>
      IntermediateRepresentationScenarioDeclaration.of({
        id: ScenarioIdentifier.of("SC-1"),
        bindings,
        hasEvent: false,
      });
    expect(declaration(ascending).equals(declaration(descending))).toBe(false);
    assertEqualityContract(
      declaration(ascending),
      declaration(declaredBindings([["Order.window", { from: 1, to: 2 }]])),
      [["bindings（キー順）", declaration(descending)]],
    );
  });
});

describe("義務と検証記録の等価性とハッシュ", () => {
  test("Obligation は id・nature・要件参照・EARS 文・4 つの式・時相の全てを見る", () => {
    const obligation = (
      overrides: {
        id?: string;
        nature?: string;
        functionalRequirementReferences?: FunctionalRequirementReferences;
        ears?: string;
        assert?: Expression;
        trigger?: TriggerName;
        guard?: Expression;
        effect?: Expression;
        temporal?: { readonly pattern: string; readonly from?: Expression; readonly to?: Expression };
      } = {},
    ) =>
      Obligation.of({
        id: ObligationIdentifier.of(overrides.id ?? "OB-1"),
        nature: ObligationNature.of(overrides.nature ?? "state-temporal"),
        functionalRequirementReferences: overrides.functionalRequirementReferences ?? requirementReferences("FR-1"),
        ears: "ears" in overrides ? overrides.ears : "While paid, the order ships.",
        assert: "assert" in overrides ? overrides.assert : ref("Order.status"),
        trigger: "trigger" in overrides ? overrides.trigger : TriggerName.of("submit"),
        guard: "guard" in overrides ? overrides.guard : ref("Order.paid"),
        effect: "effect" in overrides ? overrides.effect : ref("Order.shipped"),
        temporal:
          "temporal" in overrides
            ? overrides.temporal
            : { pattern: "leads-to", from: ref("Order.opened"), to: ref("Order.closed") },
      });
    assertEqualityContract(obligation(), obligation(), [
      ["id", obligation({ id: "OB-2" })],
      ["nature", obligation({ nature: "event" })],
      [
        "functionalRequirementReferences",
        obligation({ functionalRequirementReferences: requirementReferences("FR-2") }),
      ],
      ["ears", obligation({ ears: "When submitted, the order ships." })],
      ["ears（不在）", obligation({ ears: undefined })],
      ["assert", obligation({ assert: ref("Order.state") })],
      ["trigger", obligation({ trigger: TriggerName.of("cancel") })],
      ["trigger（不在）", obligation({ trigger: undefined })],
      ["guard", obligation({ guard: ref("Order.unpaid") })],
      ["effect", obligation({ effect: ref("Order.held") })],
      [
        "temporal.pattern",
        obligation({ temporal: { pattern: "always", from: ref("Order.opened"), to: ref("Order.closed") } }),
      ],
      [
        "temporal.to",
        obligation({ temporal: { pattern: "leads-to", from: ref("Order.opened"), to: ref("Order.void") } }),
      ],
      ["temporal（不在）", obligation({ temporal: undefined })],
    ]);
  });

  test("VerificationFinding は kind・要件参照・対象・witness・説明の全てを見る", () => {
    const finding = (
      overrides: {
        kind?: FindingKind;
        functionalRequirementReferences?: FunctionalRequirementReferences;
        targets?: FindingTargets;
        witness?: VerificationWitness;
        detail?: string;
      } = {},
    ) =>
      VerificationFinding.of({
        kind: overrides.kind ?? FindingKind.conflict(),
        functionalRequirementReferences: overrides.functionalRequirementReferences ?? requirementReferences("FR-1"),
        targets: overrides.targets ?? FindingTargets.of(TargetIdentifier.of("OB-1"), []),
        witness: overrides.witness ?? VerificationWitness.core(["g1"]),
        detail: overrides.detail ?? "guards overlap but effects contradict",
      });
    assertEqualityContract(finding(), finding(), [
      ["kind", finding({ kind: FindingKind.completenessGap() })],
      ["functionalRequirementReferences", finding({ functionalRequirementReferences: requirementReferences("FR-2") })],
      ["targets", finding({ targets: FindingTargets.of(TargetIdentifier.of("OB-2"), []) })],
      ["witness", finding({ witness: VerificationWitness.core(["g2"]) })],
      ["detail", finding({ detail: "effects agree" })],
    ]);
  });

  test("VerificationSkipped は対象・理由・省略可能な説明を見る", () => {
    const skipped = (overrides: { target?: string; reason?: SkipReason; detail?: string } = {}) =>
      VerificationSkipped.of({
        target: TargetIdentifier.of(overrides.target ?? "OB-1"),
        reason: overrides.reason ?? SkipReason.capability(),
        detail: "detail" in overrides ? overrides.detail : "bounded mode required",
      });
    assertEqualityContract(skipped(), skipped(), [
      ["target", skipped({ target: "OB-2" })],
      ["reason", skipped({ reason: SkipReason.unavailable() })],
      ["detail", skipped({ detail: "no run returned" })],
      ["detail（不在）", skipped({ detail: undefined })],
    ]);
  });

  test("SatisfiabilityModuloTheoriesEventPairProbe は 2 つのクエリ・対の両端・トリガを見る", () => {
    const probe = (overrides: { qOverlap?: string; qJoint?: string; a?: string; b?: string; trigger?: string } = {}) =>
      SatisfiabilityModuloTheoriesEventPairProbe.of({
        qOverlap: QueryLabel.of(overrides.qOverlap ?? "OB-1|OB-2|overlap"),
        qJoint: QueryLabel.of(overrides.qJoint ?? "OB-1|OB-2|joint"),
        a: ObligationIdentifier.of(overrides.a ?? "OB-1"),
        b: ObligationIdentifier.of(overrides.b ?? "OB-2"),
        trigger: TriggerName.of(overrides.trigger ?? "submit"),
      });
    assertEqualityContract(probe(), probe(), [
      ["qOverlap", probe({ qOverlap: "OB-1|OB-3|overlap" })],
      ["qJoint", probe({ qJoint: "OB-1|OB-3|joint" })],
      ["a", probe({ a: "OB-3" })],
      ["b", probe({ b: "OB-4" })],
      ["trigger", probe({ trigger: "cancel" })],
    ]);
  });
});

describe("トレース状態の等価性とハッシュ", () => {
  test("TraceState は属性パスごとの突き合わせで、挿入順に依らず等価もハッシュも一致する", () => {
    const ascending = traceState([
      ["Order.status", "open"],
      ["Order.amount", 3],
    ]);
    const descending = traceState([
      ["Order.amount", 3],
      ["Order.status", "open"],
    ]);
    // 走査順は挿入順なので、この 2 つは並びが違う。
    expect(ascending.toArray().map((entry) => entry.path().asString())).toEqual(["Order.status", "Order.amount"]);
    expect(descending.toArray().map((entry) => entry.path().asString())).toEqual(["Order.amount", "Order.status"]);
    // それでも equals は等しく、順序非依存の畳み込みでハッシュも一致する——この実装の要。
    assertEqualityContract(ascending, descending, [
      [
        "value",
        traceState([
          ["Order.status", "closed"],
          ["Order.amount", 3],
        ]),
      ],
      [
        "path",
        traceState([
          ["Order.state", "open"],
          ["Order.amount", 3],
        ]),
      ],
      ["件数", traceState([["Order.status", "open"]])],
    ]);
  });
});

describe("検証記録集約・シナリオ・クロスチェック項目・Quint機械成分の等価性とハッシュ", () => {
  test("VerificationReport は id・irVersion・irHash・method・findings・skipped・crossChecked・unavailableReason の全てを見る", () => {
    assertEqualityContract(verificationReport(), verificationReport(), [
      ["id", verificationReport({ id: VerificationReportIdentifier.of(ArtifactPath.of("other-verify"), "smt") })],
      ["irVersion", verificationReport({ irVersion: "2.0.0" })],
      ["irHash", verificationReport({ irHash: "other-model" })],
      ["method", verificationReport({ method: "simulation" })],
      ["findings", verificationReport({ findings: verificationFindingsWith("effects agree") })],
      ["skipped", verificationReport({ skipped: verificationSkipsFor("OB-3") })],
      ["crossChecked", verificationReport({ crossChecked: crossCheckedEntries("quint") })],
      ["crossChecked（不在）", verificationReport({ crossChecked: null })],
      ["unavailableReason", verificationReport({ unavailableReason: "solver unavailable" })],
    ]);
  });

  test("Scenario は id・expectation・要件参照・binding・event trigger・expect の全てを見る", () => {
    assertEqualityContract(scenario(), scenario(), [
      ["id", scenario({ id: "SC-2" })],
      ["expectation", scenario({ expectation: "reject" })],
      ["functionalRequirementReferences", scenario({ functionalRequirementReferences: requirementReferences("FR-2") })],
      ["bindings", scenario({ bindings: scenarioBindings({ "Order.status": "closed" }) })],
      ["eventTrigger", scenario({ event: { trigger: TriggerName.of("cancel") } })],
      ["eventTrigger（不在）", scenario({ event: undefined })],
      ["expect", scenario({ expect: lit(false) })],
      ["expect（不在）", scenario({ expect: undefined })],
    ]);
  });

  test("CrossCheckedEntry は backend と対象列の両方を見る", () => {
    const entry = (backend: string, targets: readonly string[]) =>
      CrossCheckedEntry.of({
        backend: BackendName.of(backend),
        targets: TargetIdentifiers.of(targets.map((t) => TargetIdentifier.of(t))),
      });
    assertEqualityContract(entry("smt", ["SC-1"]), entry("smt", ["SC-1"]), [
      ["backend", entry("quint", ["SC-1"])],
      ["targets", entry("smt", ["SC-2"])],
    ]);
  });

  test("QuintMachineComponent は id と式の正準等価の両方を見る", () => {
    const component = (id: string, expression: Expression) =>
      QuintMachineComponent.of({ id: ObligationIdentifier.of(id), expression });
    assertEqualityContract(component("OB-1", ref("Order.status")), component("OB-1", ref("Order.status")), [
      ["id", component("OB-2", ref("Order.status"))],
      ["expression", component("OB-1", ref("Order.state"))],
    ]);
  });
});

describe("IR 診断ラッパーは文字列版と同じ診断を ErrorMessages で返す", () => {
  const catalog = IntermediateRepresentationAttributeCatalog.of(
    IntermediateRepresentationEntityDeclarations.of([
      IntermediateRepresentationEntityDeclaration.of({
        name: IntermediateRepresentationEntityName.of("Order"),
        attributes: IntermediateRepresentationAttributeDeclarations.of([attributeDeclaration("status", "bool")]),
      }),
    ]),
  );

  test("IntermediateRepresentationAttributeCatalog#bindingDiagnostics は型不一致と不明属性の両方を報告する", () => {
    const bindings = declaredBindings([
      ["Order.status", 1],
      ["Order.missing", true],
    ]);
    expect(
      catalog
        .bindingDiagnostics(bindings, "scenario SC-1")
        .toArray()
        .map((message) => message.asString()),
    ).toEqual([
      'scenario SC-1: binding value 1 does not fit bool attribute "Order.status"',
      'scenario SC-1: binding for unknown attribute "Order.missing"',
    ]);
    expect(catalog.bindingDiagnostics(declaredBindings([["Order.status", true]]), "scenario SC-2").isEmpty()).toBe(
      true,
    );
  });

  test("IntermediateRepresentationEntityDeclarations#diagnostics は重複エンティティ名を報告する", () => {
    const order = (attributes: readonly IntermediateRepresentationAttributeDeclaration[]) =>
      IntermediateRepresentationEntityDeclaration.of({
        name: IntermediateRepresentationEntityName.of("Order"),
        attributes: IntermediateRepresentationAttributeDeclarations.of(attributes),
      });
    const duplicated = IntermediateRepresentationEntityDeclarations.of([
      order([attributeDeclaration("status", "bool")]),
      order([]),
    ]);
    expect(
      duplicated
        .diagnostics()
        .toArray()
        .map((message) => message.asString()),
    ).toEqual(['schema: duplicate entity "Order"']);
    expect(
      IntermediateRepresentationEntityDeclarations.of([order([attributeDeclaration("status", "bool")])])
        .diagnostics()
        .isEmpty(),
    ).toBe(true);
  });

  test("IntermediateRepresentationObligationDeclaration#diagnostics は解決できない参照を報告する", () => {
    const unresolved = IntermediateRepresentationObligationDeclaration.of({
      id: ObligationIdentifier.of("OB-1"),
      assert: ref("Order.missing"),
    });
    expect(
      unresolved
        .diagnostics(catalog)
        .toArray()
        .map((message) => message.asString()),
    ).toEqual(['obligation OB-1: unresolvable reference "Order.missing"']);
    const clean = IntermediateRepresentationObligationDeclaration.of({
      id: ObligationIdentifier.of("OB-2"),
      assert: ref("Order.status"),
    });
    expect(clean.diagnostics(catalog).isEmpty()).toBe(true);
  });

  test("IntermediateRepresentationScenarioDeclaration#diagnostics は不明な属性への束縛を報告する", () => {
    const unresolved = IntermediateRepresentationScenarioDeclaration.of({
      id: ScenarioIdentifier.of("SC-1"),
      bindings: declaredBindings([["Order.missing", true]]),
      hasEvent: false,
    });
    expect(
      unresolved
        .diagnostics(catalog)
        .toArray()
        .map((message) => message.asString()),
    ).toEqual(['scenario SC-1: binding for unknown attribute "Order.missing"']);
    const clean = IntermediateRepresentationScenarioDeclaration.of({
      id: ScenarioIdentifier.of("SC-2"),
      bindings: declaredBindings([["Order.status", true]]),
      hasEvent: false,
    });
    expect(clean.diagnostics(catalog).isEmpty()).toBe(true);
  });
});

describe("コレクションの直接アクセッサ", () => {
  test("FunctionalRequirementReferenceIndex#toArray は宣言順の主張列をそのまま返す", () => {
    const claimA = FunctionalRequirementReferenceClaim.of("obligation OB-1", requirementReferences("FR-1"));
    const claimB = FunctionalRequirementReferenceClaim.of("scenario SC-1", requirementReferences("FR-2"));
    const index = FunctionalRequirementReferenceIndex.of([claimA, claimB]);
    // toEqual は private フィールドを見ないので、要素は同一性で確かめる。
    expect([...index.toArray()]).toEqual([claimA, claimB]);
    expect(index.toArray()[0]).toBe(claimA);
    expect(index.toArray()[1]).toBe(claimB);
    expect([...index]).toEqual([...index.toArray()]);
  });

  test("QuintMachineComponents#toArray は追加順の成分列をそのまま返す", () => {
    const a = QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-1"), expression: ref("Order.status") });
    const b = QuintMachineComponent.of({ id: ObligationIdentifier.of("OB-2"), expression: ref("Order.paid") });
    const components = QuintMachineComponents.of([a]).add(b);
    expect([...components.toArray()]).toEqual([a, b]);
    expect(components.toArray()[0]).toBe(a);
    expect(components.toArray()[1]).toBe(b);
  });

  test("Scenarios#toArray は追加順のシナリオ列をそのまま返す", () => {
    const a = scenario({ id: "SC-1" });
    const b = scenario({ id: "SC-2" });
    const scenarios = Scenarios.of([a]).add(b);
    expect(scenarios.toArray()[0]).toBe(a);
    expect(scenarios.toArray()[1]).toBe(b);
    expect(scenarios.ids()).toEqual(["SC-1", "SC-2"]);
    expect(scenarios.byId("SC-2")).toBe(b);
    expect(scenarios.byId("SC-3")).toBeUndefined();
  });

  test("VerificationReports#add は末尾へ1件追加し、元のコレクションは変えない", () => {
    const first = verificationReport({
      id: VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "smt"),
    });
    const second = verificationReport({
      id: VerificationReportIdentifier.of(ArtifactPath.of("deep-spec-verify"), "quint"),
    });
    const original = VerificationReports.of([first]);
    const appended = original.add(second);
    expect(appended.toArray()[0]).toBe(first);
    expect(appended.toArray()[1]).toBe(second);
    expect(appended.count()).toBe(2);
    expect(original.toArray()[0]).toBe(first);
    expect(original.count()).toBe(1);
  });
});
