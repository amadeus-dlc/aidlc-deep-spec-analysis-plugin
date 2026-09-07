import { describe, expect, test } from "bun:test";
import {
  AttributeMapping,
  AttributeMappings,
  BusinessRuleReference,
  BusinessRuleReferences,
  DesignAssignment,
  DesignAttributeCatalogEntry,
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignBackgroundDeclaration,
  DesignBackgroundIdentifier,
  DesignEntityDeclaration,
  DesignEntityName,
  DesignEventRule,
  DesignFinding,
  DesignIgnore,
  DesignIgnoreDeclaration,
  DesignIgnoreDeclarations,
  DesignIgnores,
  DesignInputAnchor,
  DesignIntermediateRepresentationValidationMaterialsIdentifier,
  DesignMachine,
  DesignMachineDeclaration,
  DesignMachineIdentifier,
  DesignModelIdentifier,
  DesignObligation,
  DesignObligationDeclaration,
  DesignObligationIdentifier,
  DesignObligationOrigin,
  DesignReportIdentifier,
  DesignScenario,
  DesignScenarioDeclaration,
  DesignScenarioIdentifier,
  DesignSkipped,
  DesignTransition,
  DesignTransitionDeclaration,
  DesignTransitionDeclarations,
  DesignTransitionIdentifier,
  DesignTransitions,
  DesignUnitIdentifier,
  DesignWitness,
  EventMapping,
  EventMappings,
  InitialState,
  InitialStates,
  LoweredBackground,
  LoweredIdentifier,
  LoweredObligation,
  LoweredOrigin,
  LoweredOriginReference,
  LoweredScenario,
  ReachabilityVerdict,
  RefinementAttribute,
  RefinementMapIdentifier,
  RefinementMaterialsIdentifier,
  RefinementObligation,
  RefinementQueryVerdict,
  RefinementQueryVerdictEntry,
  RefinementQuintInvariant,
  RefinementScenario,
  RefinementUnitMap,
  RuleSubsumption,
  RuleSubsumptionProbe,
  RuleSubsumptionVerdict,
  SiblingVerdictFinding,
  SiblingVerdictSkip,
  TransitionReference,
  TransitionReferences,
  UnmappedDeclarations,
  UnmappedTarget,
  UnmappedTargetReference,
} from "@deep-spec-analysis/design-domain";
import {
  ArtifactPath,
  AttributeKind,
  AttributePath,
  BindingDeclaration,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  DeclaredBound,
  EnumerationMember,
  EnumerationMembers,
  type Expression,
  ExpressionTree,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  ObligationNature,
  QueryLabel,
  RequirementIdentifier,
  ScenarioExpectation,
  SkipReason,
  TargetIdentifier,
  TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { ObligationIdentifier, ScenarioIdentifier } from "@deep-spec-analysis/requirements-domain";
import { scenarioBindings } from "./binding-fixtures.ts";

// design 文脈のドメインオブジェクトが守る等価性の契約。equals と hashCode は
// 対で成り立ち、同じフィールド集合から作られていなければならない。

type Equated<T> = { equals(other: T): boolean; hashCode(): number };

// 等価性の契約をひとまとめに表明する。
// - 同じ材料から作った値どうしは等しく、必ず同じハッシュを返す（決定的でもある）。
// - variants は「equals が見ているフィールドを 1 つだけ変えた相手」の並び。
//   等しくないことに加えてハッシュも分かれることを求める。衝突そのものは契約
//   違反ではないが、固定した fixture で衝突するのは hashCode がそのフィールドを
//   畳み込んでいない印なので、equals と hashCode のフィールド集合のずれをここで
//   捕まえる。失敗したフィールド名が出力に載る。
function assertEqualityContract<T extends Equated<T>>(
  build: () => T,
  variants: Readonly<Record<string, () => T>>,
): void {
  const value = build();
  const same = build();
  expect(value.equals(same)).toBe(true);
  expect(value.hashCode()).toBe(same.hashCode());
  expect(value.hashCode()).toBe(value.hashCode());

  const fields = Object.keys(variants);
  expect(fields.length).toBeGreaterThan(0);
  const equal: string[] = [];
  const collided: string[] = [];
  for (const field of fields) {
    const other = variants[field]?.() as T;
    if (value.equals(other)) equal.push(field);
    if (value.hashCode() === other.hashCode()) collided.push(field);
  }
  expect({ equal, collided }).toEqual({ equal: [], collided: [] });
}

const expr = (value: boolean): Expression => ({ op: "bool", value });
const frRefs = (...ids: readonly string[]): FunctionalRequirementReferences =>
  FunctionalRequirementReferences.of(ids.map((id) => RequirementIdentifier.of(id)));
const brRefs = (...ids: readonly string[]): BusinessRuleReferences =>
  BusinessRuleReferences.of(ids.map((id) => BusinessRuleReference.of(id)));
const members = (...values: readonly string[]): EnumerationMembers =>
  EnumerationMembers.of(values.map((value) => EnumerationMember.of(value)));
const declaredBindings = (path: string, value: number): DeclaredBindings =>
  DeclaredBindings.of([BindingDeclaration.of(AttributePath.of(path), DeclaredBindingValue.of(Declaration.of(value)))]);
const attributeDeclaration = (name: string, kind: string): DesignAttributeDeclaration =>
  DesignAttributeDeclaration.of({ name: DesignAttributeName.of(name), kind: AttributeKind.of(kind) });
const transition = (id: string, to = "closed"): DesignTransition =>
  DesignTransition.of({
    id: DesignTransitionIdentifier.of(id),
    from: "open",
    to,
    trigger: TriggerName.of("close"),
    businessRuleReferences: brRefs("BR1.1"),
  });

describe("ドメインプリミティブ（単一の文字列で識別される値）", () => {
  test("BusinessRuleReference の等価性とハッシュは規則 id で決まる", () => {
    assertEqualityContract(() => BusinessRuleReference.of("BR1.2"), { value: () => BusinessRuleReference.of("BR2.1") });
  });

  test("DesignAttributeName の等価性とハッシュは属性名で決まる", () => {
    assertEqualityContract(() => DesignAttributeName.of("status"), { value: () => DesignAttributeName.of("total") });
  });

  test("DesignEntityName の等価性とハッシュはエンティティ名で決まる", () => {
    assertEqualityContract(() => DesignEntityName.of("Order"), { value: () => DesignEntityName.of("Payment") });
  });

  test("DesignBackgroundIdentifier の等価性とハッシュは背景仮定 id で決まる", () => {
    assertEqualityContract(() => DesignBackgroundIdentifier.of("DBG-1"), {
      value: () => DesignBackgroundIdentifier.of("DBG-2"),
    });
  });

  test("DesignMachineIdentifier の等価性とハッシュは機械 id で決まる", () => {
    assertEqualityContract(() => DesignMachineIdentifier.of("SM-1"), {
      value: () => DesignMachineIdentifier.of("SM-2"),
    });
  });

  test("DesignObligationIdentifier の等価性とハッシュは義務 id で決まる", () => {
    assertEqualityContract(() => DesignObligationIdentifier.of("DOB-1"), {
      value: () => DesignObligationIdentifier.of("DOB-2"),
    });
  });

  test("DesignObligationOrigin の等価性とハッシュは起源の語で決まり、未宣言の空も値である", () => {
    assertEqualityContract(() => DesignObligationOrigin.of("rules"), { value: () => DesignObligationOrigin.of("") });
  });

  test("DesignScenarioIdentifier の等価性とハッシュはシナリオ id で決まる", () => {
    assertEqualityContract(() => DesignScenarioIdentifier.of("DSC-1"), {
      value: () => DesignScenarioIdentifier.of("DSC-2"),
    });
  });

  test("DesignTransitionIdentifier の等価性とハッシュは遷移 id で決まる", () => {
    assertEqualityContract(() => DesignTransitionIdentifier.of("TR-1"), {
      value: () => DesignTransitionIdentifier.of("TR-2"),
    });
  });

  test("DesignUnitIdentifier の等価性とハッシュはユニット名で決まる", () => {
    assertEqualityContract(() => DesignUnitIdentifier.of("u1"), { value: () => DesignUnitIdentifier.of("u2") });
  });

  test("InitialState の等価性とハッシュは状態名で決まる", () => {
    assertEqualityContract(() => InitialState.of("open"), { value: () => InitialState.of("closed") });
  });

  test("LoweredIdentifier の等価性とハッシュは採番 id で決まり、名前空間が違えば別値になる", () => {
    assertEqualityContract(() => LoweredIdentifier.of("OB-1"), {
      連番: () => LoweredIdentifier.of("OB-2"),
      名前空間: () => LoweredIdentifier.of("SC-1"),
    });
  });

  test("LoweredOriginReference の等価性とハッシュは設計側参照で決まる", () => {
    assertEqualityContract(() => LoweredOriginReference.of("DOB-1"), {
      value: () => LoweredOriginReference.of("DOB-2"),
    });
  });

  test("TransitionReference の等価性とハッシュは写像先 id で決まる", () => {
    assertEqualityContract(() => TransitionReference.of("TR-1"), { value: () => TransitionReference.of("TR-2") });
  });

  test("UnmappedTargetReference の等価性とハッシュは宣言トークンで決まる", () => {
    assertEqualityContract(() => UnmappedTargetReference.of("OB-1"), {
      value: () => UnmappedTargetReference.of("Ticket.status"),
    });
  });

  test("ReachabilityVerdict は三態のそれぞれが別の値で、同じ態は同じハッシュを返す", () => {
    assertEqualityContract(() => ReachabilityVerdict.reached(), {
      "not-reached-within-bound": () => ReachabilityVerdict.notReachedWithinBound(),
      unverified: () => ReachabilityVerdict.unverified(),
    });
  });
});

describe("集約識別子（成果物パスに錨着する恒等）", () => {
  test("DesignModelIdentifier の等価性とハッシュは成果物パスで決まる", () => {
    assertEqualityContract(() => DesignModelIdentifier.of(ArtifactPath.of("/r/design.md")), {
      path: () => DesignModelIdentifier.of(ArtifactPath.of("/r/other.md")),
    });
  });

  test("RefinementMapIdentifier の等価性とハッシュは map の成果物パスで決まる", () => {
    assertEqualityContract(() => RefinementMapIdentifier.of(ArtifactPath.of("/r/refinement-map.md")), {
      path: () => RefinementMapIdentifier.of(ArtifactPath.of("/r/other-map.md")),
    });
  });

  test("RefinementMaterialsIdentifier の等価性とハッシュは錨着先の設計モデルで決まる", () => {
    assertEqualityContract(
      () => RefinementMaterialsIdentifier.of(DesignModelIdentifier.of(ArtifactPath.of("/r/design.md"))),
      { model: () => RefinementMaterialsIdentifier.of(DesignModelIdentifier.of(ArtifactPath.of("/r/other.md"))) },
    );
  });

  test("DesignIntermediateRepresentationValidationMaterialsIdentifier の等価性とハッシュは設計モデルで決まる", () => {
    assertEqualityContract(
      () =>
        DesignIntermediateRepresentationValidationMaterialsIdentifier.of(
          DesignModelIdentifier.of(ArtifactPath.of("/r/design.md")),
        ),
      {
        model: () =>
          DesignIntermediateRepresentationValidationMaterialsIdentifier.of(
            DesignModelIdentifier.of(ArtifactPath.of("/r/other.md")),
          ),
      },
    );
  });

  test("DesignReportIdentifier の等価性とハッシュは配置ディレクトリと backend 名の対で決まる", () => {
    assertEqualityContract(() => DesignReportIdentifier.of(ArtifactPath.of("/r/deep-spec-design-verify"), "smt"), {
      directory: () => DesignReportIdentifier.of(ArtifactPath.of("/other/deep-spec-design-verify"), "smt"),
      backend: () => DesignReportIdentifier.of(ArtifactPath.of("/r/deep-spec-design-verify"), "quint"),
    });
  });

  test("DesignInputAnchor の等価性とハッシュは成果物名と読んだ時点の sha256 の対で決まる", () => {
    assertEqualityContract(
      () => DesignInputAnchor.of({ artifact: "design.md", sha256: ContentHash.of("1".repeat(64)) }),
      {
        artifact: () => DesignInputAnchor.of({ artifact: "other.md", sha256: ContentHash.of("1".repeat(64)) }),
        sha256: () => DesignInputAnchor.of({ artifact: "design.md", sha256: ContentHash.of("2".repeat(64)) }),
      },
    );
  });
});

describe("契約3 設計 IR の宣言", () => {
  test("DesignAttributeDeclaration（enum）の等価性とハッシュは名前・種別・説明・宣言値で決まる", () => {
    const build = () =>
      DesignAttributeDeclaration.of({
        name: DesignAttributeName.of("status"),
        kind: AttributeKind.of("enum"),
        description: "生涯状態",
        values: members("open", "closed"),
      });
    assertEqualityContract(build, {
      name: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("state"),
          kind: AttributeKind.of("enum"),
          description: "生涯状態",
          values: members("open", "closed"),
        }),
      kind: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("status"),
          kind: AttributeKind.of("int"),
          description: "生涯状態",
          values: members("open", "closed"),
        }),
      description: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("status"),
          kind: AttributeKind.of("enum"),
          description: "別の説明",
          values: members("open", "closed"),
        }),
      values: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("status"),
          kind: AttributeKind.of("enum"),
          description: "生涯状態",
          values: members("open", "cancelled"),
        }),
    });
  });

  test("DesignAttributeDeclaration（int）の等価性とハッシュは宣言境界の下限と上限も畳み込む", () => {
    const build = () =>
      DesignAttributeDeclaration.of({
        name: DesignAttributeName.of("total"),
        kind: AttributeKind.of("int"),
        min: DeclaredBound.of(0),
        max: DeclaredBound.of(10),
      });
    assertEqualityContract(build, {
      min: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("total"),
          kind: AttributeKind.of("int"),
          min: DeclaredBound.of(1),
          max: DeclaredBound.of(10),
        }),
      max: () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("total"),
          kind: AttributeKind.of("int"),
          min: DeclaredBound.of(0),
          max: DeclaredBound.of(11),
        }),
      "max 欠落": () =>
        DesignAttributeDeclaration.of({
          name: DesignAttributeName.of("total"),
          kind: AttributeKind.of("int"),
          min: DeclaredBound.of(0),
        }),
    });
  });

  test("DesignEntityDeclaration の等価性とハッシュは名前・説明・属性宣言の列で決まる", () => {
    const build = () =>
      DesignEntityDeclaration.of({
        name: DesignEntityName.of("Order"),
        description: "注文",
        attributes: DesignAttributeDeclarations.of([attributeDeclaration("status", "enum")]),
      });
    assertEqualityContract(build, {
      name: () =>
        DesignEntityDeclaration.of({
          name: DesignEntityName.of("Payment"),
          description: "注文",
          attributes: DesignAttributeDeclarations.of([attributeDeclaration("status", "enum")]),
        }),
      description: () =>
        DesignEntityDeclaration.of({
          name: DesignEntityName.of("Order"),
          description: "別の説明",
          attributes: DesignAttributeDeclarations.of([attributeDeclaration("status", "enum")]),
        }),
      attributes: () =>
        DesignEntityDeclaration.of({
          name: DesignEntityName.of("Order"),
          description: "注文",
          attributes: DesignAttributeDeclarations.of([attributeDeclaration("total", "int")]),
        }),
    });
  });

  test("DesignAttributeCatalogEntry の等価性とハッシュは所有エンティティと属性宣言（と導かれる座標）で決まる", () => {
    assertEqualityContract(
      () => DesignAttributeCatalogEntry.of(DesignEntityName.of("Order"), attributeDeclaration("status", "enum")),
      {
        // 所有エンティティを変えると座標（Order.status → Payment.status）も動く。
        owner: () =>
          DesignAttributeCatalogEntry.of(DesignEntityName.of("Payment"), attributeDeclaration("status", "enum")),
        attribute: () =>
          DesignAttributeCatalogEntry.of(DesignEntityName.of("Order"), attributeDeclaration("total", "int")),
      },
    );
  });

  test("DesignBackgroundDeclaration の等価性とハッシュは id と表明式で決まる", () => {
    const build = () =>
      DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expr(true) });
    assertEqualityContract(build, {
      id: () => DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-2"), assert: expr(true) }),
      assert: () => DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1"), assert: expr(false) }),
      "assert 欠落": () => DesignBackgroundDeclaration.of({ id: DesignBackgroundIdentifier.of("DBG-1") }),
    });
  });

  test("DesignObligationDeclaration の等価性とハッシュは id・起源・BR 参照・三つの式・時相宣言で決まる", () => {
    const build = () =>
      DesignObligationDeclaration.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        origin: DesignObligationOrigin.of("rules"),
        businessRuleReferences: brRefs("BR1.1"),
        assert: { op: "assert" },
        guard: { op: "guard" },
        effect: { op: "effect" },
        temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
      });
    const withTemporal = (temporal: { assert?: Expression; from?: Expression; to?: Expression }) =>
      DesignObligationDeclaration.of({
        id: DesignObligationIdentifier.of("DOB-1"),
        origin: DesignObligationOrigin.of("rules"),
        businessRuleReferences: brRefs("BR1.1"),
        assert: { op: "assert" },
        guard: { op: "guard" },
        effect: { op: "effect" },
        temporal,
      });
    assertEqualityContract(build, {
      id: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-2"),
          origin: DesignObligationOrigin.of("rules"),
          businessRuleReferences: brRefs("BR1.1"),
          assert: { op: "assert" },
          guard: { op: "guard" },
          effect: { op: "effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      origin: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-1"),
          origin: DesignObligationOrigin.of(""),
          businessRuleReferences: brRefs("BR1.1"),
          assert: { op: "assert" },
          guard: { op: "guard" },
          effect: { op: "effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      businessRuleReferences: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-1"),
          origin: DesignObligationOrigin.of("rules"),
          businessRuleReferences: brRefs("BR2.1"),
          assert: { op: "assert" },
          guard: { op: "guard" },
          effect: { op: "effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      assert: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-1"),
          origin: DesignObligationOrigin.of("rules"),
          businessRuleReferences: brRefs("BR1.1"),
          assert: { op: "other-assert" },
          guard: { op: "guard" },
          effect: { op: "effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      guard: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-1"),
          origin: DesignObligationOrigin.of("rules"),
          businessRuleReferences: brRefs("BR1.1"),
          assert: { op: "assert" },
          guard: { op: "other-guard" },
          effect: { op: "effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      effect: () =>
        DesignObligationDeclaration.of({
          id: DesignObligationIdentifier.of("DOB-1"),
          origin: DesignObligationOrigin.of("rules"),
          businessRuleReferences: brRefs("BR1.1"),
          assert: { op: "assert" },
          guard: { op: "guard" },
          effect: { op: "other-effect" },
          temporal: { assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
        }),
      "temporal.assert": () => withTemporal({ assert: { op: "other-ta" }, from: { op: "tf" }, to: { op: "tt" } }),
      "temporal.from": () => withTemporal({ assert: { op: "ta" }, from: { op: "other-tf" }, to: { op: "tt" } }),
      "temporal.to": () => withTemporal({ assert: { op: "ta" }, from: { op: "tf" }, to: { op: "other-tt" } }),
    });
  });

  test("DesignScenarioDeclaration の等価性とハッシュは id・binding・イベント有無・期待式・BR 参照で決まる", () => {
    const build = () =>
      DesignScenarioDeclaration.of({
        id: DesignScenarioIdentifier.of("DSC-1"),
        bindings: declaredBindings("Order.total", 1),
        hasEvent: true,
        expect: expr(true),
        businessRuleReferences: brRefs("BR1.1"),
      });
    assertEqualityContract(build, {
      id: () =>
        DesignScenarioDeclaration.of({
          id: DesignScenarioIdentifier.of("DSC-2"),
          bindings: declaredBindings("Order.total", 1),
          hasEvent: true,
          expect: expr(true),
          businessRuleReferences: brRefs("BR1.1"),
        }),
      bindings: () =>
        DesignScenarioDeclaration.of({
          id: DesignScenarioIdentifier.of("DSC-1"),
          bindings: declaredBindings("Order.total", 2),
          hasEvent: true,
          expect: expr(true),
          businessRuleReferences: brRefs("BR1.1"),
        }),
      hasEvent: () =>
        DesignScenarioDeclaration.of({
          id: DesignScenarioIdentifier.of("DSC-1"),
          bindings: declaredBindings("Order.total", 1),
          hasEvent: false,
          expect: expr(true),
          businessRuleReferences: brRefs("BR1.1"),
        }),
      expect: () =>
        DesignScenarioDeclaration.of({
          id: DesignScenarioIdentifier.of("DSC-1"),
          bindings: declaredBindings("Order.total", 1),
          hasEvent: true,
          expect: expr(false),
          businessRuleReferences: brRefs("BR1.1"),
        }),
      businessRuleReferences: () =>
        DesignScenarioDeclaration.of({
          id: DesignScenarioIdentifier.of("DSC-1"),
          bindings: declaredBindings("Order.total", 1),
          hasEvent: true,
          expect: expr(true),
          businessRuleReferences: brRefs("BR2.1"),
        }),
    });
  });

  test("DesignTransitionDeclaration の等価性とハッシュは id・前後状態・トリガ・BR 参照・ガードと効果で決まる", () => {
    const base = {
      id: DesignTransitionIdentifier.of("TR-1"),
      from: "open",
      to: "closed",
      trigger: TriggerName.of("close"),
      businessRuleReferences: brRefs("BR1.1"),
      guard: { op: "guard" } as Expression,
      effect: { op: "effect" } as Expression,
    };
    assertEqualityContract(() => DesignTransitionDeclaration.of({ ...base }), {
      id: () => DesignTransitionDeclaration.of({ ...base, id: DesignTransitionIdentifier.of("TR-2") }),
      from: () => DesignTransitionDeclaration.of({ ...base, from: "draft" }),
      to: () => DesignTransitionDeclaration.of({ ...base, to: "cancelled" }),
      trigger: () => DesignTransitionDeclaration.of({ ...base, trigger: TriggerName.of("cancel") }),
      businessRuleReferences: () =>
        DesignTransitionDeclaration.of({ ...base, businessRuleReferences: brRefs("BR2.1") }),
      guard: () => DesignTransitionDeclaration.of({ ...base, guard: { op: "other-guard" } }),
      effect: () => DesignTransitionDeclaration.of({ ...base, effect: { op: "other-effect" } }),
    });
  });

  test("DesignIgnoreDeclaration の等価性とハッシュは状態とトリガの対で決まる", () => {
    assertEqualityContract(() => DesignIgnoreDeclaration.of({ state: "open", trigger: TriggerName.of("close") }), {
      state: () => DesignIgnoreDeclaration.of({ state: "closed", trigger: TriggerName.of("close") }),
      trigger: () => DesignIgnoreDeclaration.of({ state: "open", trigger: TriggerName.of("cancel") }),
    });
  });

  test("DesignMachineDeclaration の等価性とハッシュは id・生涯属性・初期状態・遷移・ignore で決まる", () => {
    const base = {
      id: DesignMachineIdentifier.of("SM-1"),
      attrPath: "Order.status",
      initial: InitialStates.of([InitialState.of("open")]),
      transitions: DesignTransitionDeclarations.of([
        DesignTransitionDeclaration.of({
          id: DesignTransitionIdentifier.of("TR-1"),
          from: "open",
          to: "closed",
          trigger: TriggerName.of("close"),
        }),
      ]),
      ignores: DesignIgnoreDeclarations.of([
        DesignIgnoreDeclaration.of({ state: "closed", trigger: TriggerName.of("close") }),
      ]),
    };
    assertEqualityContract(() => DesignMachineDeclaration.of({ ...base }), {
      id: () => DesignMachineDeclaration.of({ ...base, id: DesignMachineIdentifier.of("SM-2") }),
      attrPath: () => DesignMachineDeclaration.of({ ...base, attrPath: "Payment.status" }),
      initial: () => DesignMachineDeclaration.of({ ...base, initial: InitialStates.of([InitialState.of("draft")]) }),
      transitions: () =>
        DesignMachineDeclaration.of({
          ...base,
          transitions: DesignTransitionDeclarations.of([
            DesignTransitionDeclaration.of({
              id: DesignTransitionIdentifier.of("TR-2"),
              from: "open",
              to: "closed",
              trigger: TriggerName.of("close"),
            }),
          ]),
        }),
      ignores: () =>
        DesignMachineDeclaration.of({
          ...base,
          ignores: DesignIgnoreDeclarations.of([
            DesignIgnoreDeclaration.of({ state: "draft", trigger: TriggerName.of("close") }),
          ]),
        }),
    });
  });
});

describe("設計モデルの要素", () => {
  test("DesignAssignment の等価性とハッシュは代入先の座標と右辺で決まる", () => {
    assertEqualityContract(() => DesignAssignment.of(AttributePath.of("Order.total"), ExpressionTree.of(expr(true))), {
      target: () => DesignAssignment.of(AttributePath.of("Order.status"), ExpressionTree.of(expr(true))),
      rightHandSide: () => DesignAssignment.of(AttributePath.of("Order.total"), ExpressionTree.of(expr(false))),
    });
  });

  test("DesignIgnore の等価性とハッシュは状態とトリガの対で決まる", () => {
    assertEqualityContract(() => DesignIgnore.of({ state: "open", trigger: TriggerName.of("close") }), {
      state: () => DesignIgnore.of({ state: "closed", trigger: TriggerName.of("close") }),
      trigger: () => DesignIgnore.of({ state: "open", trigger: TriggerName.of("cancel") }),
    });
  });

  test("DesignMachine の等価性とハッシュは id・生涯属性の座標・初期状態・遷移・ignore・決定性宣言で決まる", () => {
    const base = {
      id: DesignMachineIdentifier.of("SM-1"),
      entity: DesignEntityName.of("Order"),
      attribute: DesignAttributeName.of("status"),
      initial: InitialStates.of([InitialState.of("open")]),
      transitions: DesignTransitions.of([transition("TR-1")]),
      ignores: DesignIgnores.of([DesignIgnore.of({ state: "closed", trigger: TriggerName.of("close") })]),
      deterministic: true,
    };
    assertEqualityContract(() => DesignMachine.of({ ...base }), {
      id: () => DesignMachine.of({ ...base, id: DesignMachineIdentifier.of("SM-2") }),
      entity: () => DesignMachine.of({ ...base, entity: DesignEntityName.of("Payment") }),
      attribute: () => DesignMachine.of({ ...base, attribute: DesignAttributeName.of("state") }),
      initial: () => DesignMachine.of({ ...base, initial: InitialStates.of([InitialState.of("draft")]) }),
      transitions: () => DesignMachine.of({ ...base, transitions: DesignTransitions.of([transition("TR-2")]) }),
      ignores: () =>
        DesignMachine.of({
          ...base,
          ignores: DesignIgnores.of([DesignIgnore.of({ state: "draft", trigger: TriggerName.of("close") })]),
        }),
      deterministic: () => DesignMachine.of({ ...base, deterministic: false }),
    });
  });

  test("DesignObligation の等価性とハッシュは id・分類・起源・BR/FR 参照・トリガ・三つの式・時相宣言で決まる", () => {
    const base = {
      id: DesignObligationIdentifier.of("DOB-1"),
      nature: ObligationNature.of("event"),
      origin: DesignObligationOrigin.of("rules"),
      businessRuleReferences: brRefs("BR1.1"),
      functionalRequirementReferences: frRefs("FR-1"),
      assert: { op: "assert" } as Expression,
      trigger: TriggerName.of("submit"),
      guard: { op: "guard" } as Expression,
      effect: { op: "effect" } as Expression,
      temporal: { pattern: "leads-to", assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
    };
    assertEqualityContract(() => DesignObligation.of({ ...base }), {
      id: () => DesignObligation.of({ ...base, id: DesignObligationIdentifier.of("DOB-2") }),
      nature: () => DesignObligation.of({ ...base, nature: ObligationNature.of("invariant") }),
      origin: () => DesignObligation.of({ ...base, origin: DesignObligationOrigin.of("") }),
      businessRuleReferences: () => DesignObligation.of({ ...base, businessRuleReferences: brRefs("BR2.1") }),
      functionalRequirementReferences: () =>
        DesignObligation.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      assert: () => DesignObligation.of({ ...base, assert: { op: "other-assert" } }),
      trigger: () => DesignObligation.of({ ...base, trigger: TriggerName.of("close") }),
      guard: () => DesignObligation.of({ ...base, guard: { op: "other-guard" } }),
      effect: () => DesignObligation.of({ ...base, effect: { op: "other-effect" } }),
      "temporal.pattern": () => DesignObligation.of({ ...base, temporal: { ...base.temporal, pattern: "always" } }),
      "temporal.to": () => DesignObligation.of({ ...base, temporal: { ...base.temporal, to: { op: "other-tt" } } }),
    });
  });

  test("DesignScenario の等価性とハッシュは id・期待・BR/FR 参照・binding・イベント・期待式で決まる", () => {
    const base = {
      id: DesignScenarioIdentifier.of("DSC-1"),
      expectation: ScenarioExpectation.of("accept"),
      businessRuleReferences: brRefs("BR1.1"),
      functionalRequirementReferences: frRefs("FR-1"),
      bindings: scenarioBindings({ "Order.total": 1 }),
      event: { trigger: TriggerName.of("submit") },
      expect: expr(true) as Expression,
    };
    assertEqualityContract(() => DesignScenario.of({ ...base }), {
      id: () => DesignScenario.of({ ...base, id: DesignScenarioIdentifier.of("DSC-2") }),
      expectation: () => DesignScenario.of({ ...base, expectation: ScenarioExpectation.of("reject") }),
      businessRuleReferences: () => DesignScenario.of({ ...base, businessRuleReferences: brRefs("BR2.1") }),
      functionalRequirementReferences: () =>
        DesignScenario.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      bindings: () => DesignScenario.of({ ...base, bindings: scenarioBindings({ "Order.total": 2 }) }),
      event: () => DesignScenario.of({ ...base, event: { trigger: TriggerName.of("close") } }),
      expect: () => DesignScenario.of({ ...base, expect: expr(false) }),
    });
  });
});

describe("検証結果の語彙", () => {
  test("DesignFinding の等価性とハッシュは種別・ユニット・文言・FR 参照・対象・証拠で決まる", () => {
    const base = {
      kind: FindingKind.conflict(),
      functionalRequirementReferences: frRefs("FR-1"),
      targets: FindingTargets.of(TargetIdentifier.of("DOB-1"), []),
      witness: DesignWitness.core(["OB-1"]),
      unit: UnitName.of("u1"),
      detail: "同一 (state, trigger) の重複",
    };
    assertEqualityContract(() => DesignFinding.of({ ...base }), {
      kind: () => DesignFinding.of({ ...base, kind: FindingKind.redundancy() }),
      functionalRequirementReferences: () =>
        DesignFinding.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      targets: () => DesignFinding.of({ ...base, targets: FindingTargets.of(TargetIdentifier.of("DOB-2"), []) }),
      witness: () => DesignFinding.of({ ...base, witness: DesignWitness.core(["OB-2"]) }),
      unit: () => DesignFinding.of({ ...base, unit: UnitName.of("u2") }),
      detail: () => DesignFinding.of({ ...base, detail: "別の文言" }),
    });
  });

  test("DesignSkipped の等価性とハッシュは対象・理由・ユニット・文言で決まる", () => {
    const base = {
      target: TargetIdentifier.of("DOB-1"),
      reason: SkipReason.timeout(),
      unit: UnitName.of("u1"),
      detail: "solver budget",
    };
    assertEqualityContract(() => DesignSkipped.of({ ...base }), {
      target: () => DesignSkipped.of({ ...base, target: TargetIdentifier.of("DOB-2") }),
      reason: () => DesignSkipped.of({ ...base, reason: SkipReason.capability() }),
      unit: () => DesignSkipped.of({ ...base, unit: UnitName.of("u2") }),
      detail: () => DesignSkipped.of({ ...base, detail: "別の文言" }),
    });
  });

  test("SiblingVerdictSkip の等価性とハッシュは lowered 対象・理由・文言で決まる", () => {
    const base = { target: LoweredIdentifier.of("OB-1"), reason: SkipReason.timeout(), detail: "wait" };
    assertEqualityContract(() => SiblingVerdictSkip.of({ ...base }), {
      target: () => SiblingVerdictSkip.of({ ...base, target: LoweredIdentifier.of("OB-2") }),
      reason: () => SiblingVerdictSkip.of({ ...base, reason: SkipReason.capability() }),
      detail: () => SiblingVerdictSkip.of({ ...base, detail: "別の文言" }),
    });
  });

  test("RuleSubsumption の等価性とハッシュは対象の組と畳み込んだ finding で決まる", () => {
    const rule = (id: string) =>
      DesignEventRule.of({
        reference: DesignObligationIdentifier.of(id),
        trigger: TriggerName.of("save"),
        guard: { op: "bool", value: true },
        effect: { op: "bool", value: true },
      });
    const relation = (
      subsumer: string,
      subsumed: string,
      witness = DesignWitness.core(["OB-1"]),
      unit = UnitName.of("u1"),
      references = frRefs("FR-1"),
    ) =>
      RuleSubsumption.of(
        RuleSubsumptionVerdict.fromFinding(
          RuleSubsumptionProbe.of({ subsumer: rule(subsumer), subsumed: rule(subsumed) }),
          SiblingVerdictFinding.of({
            kind: FindingKind.conflict(),
            targets: [LoweredIdentifier.of("OB-1")],
            functionalRequirementReferences: references,
            witness: DesignWitness.core([]),
            detail: "solver evidence",
          }),
          witness,
          unit,
        ),
      );
    assertEqualityContract(() => relation("DOB-1", "DOB-2"), {
      対象の組: () => relation("DOB-3", "DOB-4"),
      // 逆向きは対象の組が同じまま finding の文言だけが入れ替わる。
      向き: () => relation("DOB-2", "DOB-1"),
      証拠: () => relation("DOB-1", "DOB-2", DesignWitness.core(["OB-9"])),
      ユニット: () => relation("DOB-1", "DOB-2", DesignWitness.core(["OB-1"]), UnitName.of("u2")),
      FR参照: () => relation("DOB-1", "DOB-2", DesignWitness.core(["OB-1"]), UnitName.of("u1"), frRefs("FR-2")),
    });
  });
});

describe("契約1 へ降ろした lowered 文書の要素", () => {
  test("LoweredBackground の等価性とハッシュは id と表明式で決まる", () => {
    assertEqualityContract(() => LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: expr(true) }), {
      id: () => LoweredBackground.of({ id: LoweredIdentifier.of("BG-2"), assert: expr(true) }),
      assert: () => LoweredBackground.of({ id: LoweredIdentifier.of("BG-1"), assert: expr(false) }),
    });
  });

  test("LoweredObligation の等価性とハッシュは id・帰属（参照と種別）・分類・FR 参照・四つの式で決まる", () => {
    const origin = (kind: "passthrough" | "ignore" | "vac-dead", design: string) =>
      LoweredOrigin.of({ kind, design: LoweredOriginReference.of(design) });
    const base = {
      id: LoweredIdentifier.of("OB-1"),
      origin: origin("passthrough", "DOB-1"),
      nature: ObligationNature.of("event"),
      functionalRequirementReferences: frRefs("FR-1"),
      assert: { op: "assert" } as Expression,
      trigger: TriggerName.of("submit"),
      guard: { op: "guard" } as Expression,
      effect: { op: "effect" } as Expression,
      temporal: { pattern: "leads-to", assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
    };
    assertEqualityContract(() => LoweredObligation.of({ ...base }), {
      id: () => LoweredObligation.of({ ...base, id: LoweredIdentifier.of("OB-2") }),
      "origin.design": () => LoweredObligation.of({ ...base, origin: origin("passthrough", "DOB-2") }),
      "origin.kind": () => LoweredObligation.of({ ...base, origin: origin("ignore", "DOB-1") }),
      nature: () => LoweredObligation.of({ ...base, nature: ObligationNature.of("invariant") }),
      functionalRequirementReferences: () =>
        LoweredObligation.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      assert: () => LoweredObligation.of({ ...base, assert: { op: "other-assert" } }),
      trigger: () => LoweredObligation.of({ ...base, trigger: TriggerName.of("close") }),
      guard: () => LoweredObligation.of({ ...base, guard: { op: "other-guard" } }),
      effect: () => LoweredObligation.of({ ...base, effect: { op: "other-effect" } }),
      "temporal.pattern": () => LoweredObligation.of({ ...base, temporal: { ...base.temporal, pattern: "always" } }),
      "temporal.from": () =>
        LoweredObligation.of({ ...base, temporal: { ...base.temporal, from: { op: "other-tf" } } }),
    });
  });

  test("LoweredScenario の等価性とハッシュは id・由来・期待・FR 参照・binding・イベント・期待式で決まる", () => {
    const base = {
      id: LoweredIdentifier.of("SC-1"),
      origin: DesignScenarioIdentifier.of("DSC-1"),
      expectation: ScenarioExpectation.of("accept"),
      functionalRequirementReferences: frRefs("FR-1"),
      bindings: scenarioBindings({ "Order.total": 1 }),
      event: { trigger: TriggerName.of("submit") },
      expect: expr(true) as Expression,
    };
    assertEqualityContract(() => LoweredScenario.of({ ...base }), {
      id: () => LoweredScenario.of({ ...base, id: LoweredIdentifier.of("SC-2") }),
      origin: () => LoweredScenario.of({ ...base, origin: DesignScenarioIdentifier.of("DSC-2") }),
      expectation: () => LoweredScenario.of({ ...base, expectation: ScenarioExpectation.of("reject") }),
      functionalRequirementReferences: () =>
        LoweredScenario.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      bindings: () => LoweredScenario.of({ ...base, bindings: scenarioBindings({ "Order.total": 2 }) }),
      event: () => LoweredScenario.of({ ...base, event: { trigger: TriggerName.of("close") } }),
      expect: () => LoweredScenario.of({ ...base, expect: expr(false) }),
    });
  });
});

describe("契約4 refinement の語彙", () => {
  test("RefinementAttribute の等価性とハッシュはパス・種類・enum 宣言値で決まる", () => {
    assertEqualityContract(
      () =>
        RefinementAttribute.of({
          path: AttributePath.of("Ticket.status"),
          kind: "enum",
          values: members("open", "closed"),
        }),
      {
        path: () =>
          RefinementAttribute.of({
            path: AttributePath.of("Ticket.state"),
            kind: "enum",
            values: members("open", "closed"),
          }),
        kind: () =>
          RefinementAttribute.of({
            path: AttributePath.of("Ticket.status"),
            kind: "bool",
            values: members("open", "closed"),
          }),
        values: () =>
          RefinementAttribute.of({
            path: AttributePath.of("Ticket.status"),
            kind: "enum",
            values: members("open", "cancelled"),
          }),
        "values 欠落": () => RefinementAttribute.of({ path: AttributePath.of("Ticket.status"), kind: "enum" }),
      },
    );
  });

  test("RefinementObligation の等価性とハッシュは id・分類・FR 参照・トリガ・三つの式で決まる", () => {
    const base = {
      id: ObligationIdentifier.of("OB-1"),
      nature: ObligationNature.of("event"),
      functionalRequirementReferences: frRefs("FR-1"),
      assert: { op: "assert" } as Expression,
      trigger: TriggerName.of("submit"),
      guard: { op: "guard" } as Expression,
      effect: { op: "effect" } as Expression,
    };
    assertEqualityContract(() => RefinementObligation.of({ ...base }), {
      id: () => RefinementObligation.of({ ...base, id: ObligationIdentifier.of("OB-2") }),
      nature: () => RefinementObligation.of({ ...base, nature: ObligationNature.of("invariant") }),
      functionalRequirementReferences: () =>
        RefinementObligation.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      assert: () => RefinementObligation.of({ ...base, assert: { op: "other-assert" } }),
      trigger: () => RefinementObligation.of({ ...base, trigger: TriggerName.of("close") }),
      guard: () => RefinementObligation.of({ ...base, guard: { op: "other-guard" } }),
      effect: () => RefinementObligation.of({ ...base, effect: { op: "other-effect" } }),
    });
  });

  test("RefinementScenario の等価性とハッシュは id・期待・FR 参照・binding・イベントで決まる", () => {
    const base = {
      id: ScenarioIdentifier.of("SC-1"),
      expectation: ScenarioExpectation.of("accept"),
      functionalRequirementReferences: frRefs("FR-1"),
      bindings: scenarioBindings({ "Ticket.status": 1 }),
      event: { trigger: TriggerName.of("submit") },
    };
    assertEqualityContract(() => RefinementScenario.of({ ...base }), {
      id: () => RefinementScenario.of({ ...base, id: ScenarioIdentifier.of("SC-2") }),
      expectation: () => RefinementScenario.of({ ...base, expectation: ScenarioExpectation.of("reject") }),
      functionalRequirementReferences: () =>
        RefinementScenario.of({ ...base, functionalRequirementReferences: frRefs("FR-2") }),
      bindings: () => RefinementScenario.of({ ...base, bindings: scenarioBindings({ "Ticket.status": 2 }) }),
      event: () => RefinementScenario.of({ ...base, event: { trigger: TriggerName.of("close") } }),
    });
  });

  test("RefinementQuintInvariant の等価性とハッシュは要件義務 id と表明式で決まる", () => {
    assertEqualityContract(
      () => RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs("FR-1"), expr(true)),
      {
        reqId: () => RefinementQuintInvariant.of(ObligationIdentifier.of("OB-2"), frRefs("FR-1"), expr(true)),
        expr: () => RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs("FR-1"), expr(false)),
      },
    );
  });

  test("RefinementQuintInvariant の恒等は FR 参照を含まない——運ぶだけの帰属は同一視される", () => {
    const invariant = RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs("FR-1"), expr(true));
    const otherReferences = RefinementQuintInvariant.of(ObligationIdentifier.of("OB-1"), frRefs("FR-2"), expr(true));
    expect(invariant.equals(otherReferences)).toBe(true);
    expect(invariant.hashCode()).toBe(otherReferences.hashCode());
  });

  test("EventMapping の等価性とハッシュは要件トリガ・写像先の遷移・免除理由で決まる", () => {
    const base = {
      reqTrigger: TriggerName.of("submit"),
      transitions: TransitionReferences.of([TransitionReference.of("TR-1")]),
      waived: { reason: "v1 では写像しない" },
    };
    assertEqualityContract(() => EventMapping.of({ ...base }), {
      reqTrigger: () => EventMapping.of({ ...base, reqTrigger: TriggerName.of("close") }),
      transitions: () =>
        EventMapping.of({ ...base, transitions: TransitionReferences.of([TransitionReference.of("TR-2")]) }),
      "waived.reason": () => EventMapping.of({ ...base, waived: { reason: "別の理由" } }),
      免除なし: () => EventMapping.of({ reqTrigger: base.reqTrigger, transitions: base.transitions }),
    });
  });

  test("UnmappedTarget の等価性とハッシュは対象と理由で決まる", () => {
    assertEqualityContract(
      () => UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "v1 の対象外" }),
      {
        target: () => UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-2"), reason: "v1 の対象外" }),
        reason: () => UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "別の理由" }),
      },
    );
  });

  test("RefinementUnitMap の等価性とハッシュはユニット・属性写像・イベント写像・unmapped 宣言で決まる", () => {
    const mapping = (path: string) =>
      AttributeMapping.of(AttributePath.of(path), { kind: "expression", expr: { op: "int", value: 1 } });
    const base = {
      unit: DesignUnitIdentifier.of("u1"),
      attrMap: AttributeMappings.of([mapping("Ticket.total")]),
      eventMap: EventMappings.of([
        EventMapping.of({
          reqTrigger: TriggerName.of("submit"),
          transitions: TransitionReferences.of([TransitionReference.of("TR-1")]),
        }),
      ]),
      unmapped: UnmappedDeclarations.of([
        UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-1"), reason: "v1 の対象外" }),
      ]),
    };
    assertEqualityContract(() => RefinementUnitMap.of({ ...base }), {
      unit: () => RefinementUnitMap.of({ ...base, unit: DesignUnitIdentifier.of("u2") }),
      attrMap: () => RefinementUnitMap.of({ ...base, attrMap: AttributeMappings.of([mapping("Ticket.count")]) }),
      eventMap: () =>
        RefinementUnitMap.of({
          ...base,
          eventMap: EventMappings.of([
            EventMapping.of({
              reqTrigger: TriggerName.of("close"),
              transitions: TransitionReferences.of([TransitionReference.of("TR-1")]),
            }),
          ]),
        }),
      unmapped: () =>
        RefinementUnitMap.of({
          ...base,
          unmapped: UnmappedDeclarations.of([
            UnmappedTarget.of({ target: UnmappedTargetReference.of("OB-2"), reason: "v1 の対象外" }),
          ]),
        }),
    });
  });

  test("RefinementQueryVerdict の等価性とハッシュは状態・unsat core・pre/post の復号モデルで決まる", () => {
    const base = {
      status: "sat" as const,
      decodedModel: { "Ticket.status": "open" },
      decodedPostModel: { "Ticket.status": "closed" },
      core: ["q1"],
    };
    assertEqualityContract(() => RefinementQueryVerdict.of({ ...base, core: [...base.core] }), {
      status: () => RefinementQueryVerdict.of({ ...base, status: "unsat", core: [...base.core] }),
      core: () => RefinementQueryVerdict.of({ ...base, core: ["q2"] }),
      decodedModel: () =>
        RefinementQueryVerdict.of({ ...base, decodedModel: { "Ticket.status": "draft" }, core: [...base.core] }),
      decodedPostModel: () =>
        RefinementQueryVerdict.of({
          ...base,
          decodedPostModel: { "Ticket.status": "cancelled" },
          core: [...base.core],
        }),
    });
  });

  test("RefinementQueryVerdictEntry の等価性とハッシュはクエリラベルと判定の対で決まる", () => {
    assertEqualityContract(
      () => RefinementQueryVerdictEntry.of(QueryLabel.of("q1"), RefinementQueryVerdict.of({ status: "sat" })),
      {
        query: () => RefinementQueryVerdictEntry.of(QueryLabel.of("q2"), RefinementQueryVerdict.of({ status: "sat" })),
        verdict: () =>
          RefinementQueryVerdictEntry.of(QueryLabel.of("q1"), RefinementQueryVerdict.of({ status: "unsat" })),
      },
    );
  });
});
