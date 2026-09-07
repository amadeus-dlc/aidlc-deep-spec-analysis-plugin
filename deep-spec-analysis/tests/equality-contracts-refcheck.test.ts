// refcheck/domain の等価性契約テスト。
//
// equals と hashCode は対で成り立つ:
//   - 等しい値は必ず等しいハッシュを返す（逆は要求しない——衝突は許される）
//   - 同じ値から何度呼んでも同じ値を返す（決定的）
//   - equals が見ているフィールドは hashCode も畳み込む
// 型ごとに「フィールドを 1 つだけ変えた相手」を並べて、この 3 点を表明する。
// toDocument() は golden バイト凍結の描画なので、キーの順と値を逐語で表明する。

import { describe, expect, test } from "bun:test";

import {
  ArtifactPath,
  ContentHash,
  ErrorMessage,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  RequirementIdentifier,
  SkipReason,
  TargetIdentifier,
} from "@deep-spec-analysis/kernel-domain";
import {
  AllowedValue,
  AttributeDeclarations,
  AttributeName,
  BlockIndex,
  BusinessRuleIdentifier,
  CardinalityNotation,
  CheckFamily,
  ComponentEntity,
  ComponentName,
  ComponentReference,
  ComponentShapeError,
  ContractIdentifier,
  ContractParty,
  ContractRow,
  DesignRecordIdentifier,
  ElementPath,
  EntityDeclaration,
  EntityDeclarations,
  EntityName,
  EntityReference,
  EntityReferences,
  Finding,
  InputAnchor,
  LineNumber,
  MachineSpecification,
  NumericBound,
  ReferenceCheckReportIdentifier,
  ReferenceTarget,
  RelationshipDeclaration,
  RelationshipDeclarations,
  RuleCategory,
  ShapeError,
  SiblingUnitIndexEntry,
  Skipped,
  SourceIdentifier,
  StateMachineSketch,
  StateName,
  StateNames,
  UnitDeclaration,
  UnitName,
  UnitNames,
  WitnessReference,
  WitnessReferences,
} from "@deep-spec-analysis/refcheck-domain";

type Equatable<T> = { equals(other: T): boolean; hashCode(): number };

/** フィールドを 1 つだけ変えた相手。ラベルは失敗時にどのフィールドかを示す。 */
type Variant<T> = readonly [field: string, make: () => T];

function assertEqualityContract<T extends Equatable<T>>(base: () => T, variants: readonly Variant<T>[]): void {
  const value = base();
  const same = base();

  expect(value.equals(same)).toBe(true);
  // 等しい値は必ず等しいハッシュ（逆は要求しない——衝突は許される）。
  expect(value.hashCode()).toBe(same.hashCode());
  // 同じ値から何度呼んでも同じ（決定的）。
  expect(value.hashCode()).toBe(value.hashCode());

  for (const [field, make] of variants) {
    const other = make();
    // equals はこのフィールドを見ている。
    expect([field, value.equals(other)]).toEqual([field, false]);
    // hashCode はこのフィールドを畳み込んでいる。ここで選んだ値では衝突しないので、
    // ハッシュが変わらなければ畳み込みから漏れている。
    expect([field, value.hashCode() === other.hashCode()]).toEqual([field, false]);
  }
}

/** 保持する 1 値だけで等価性が決まる値オブジェクト。 */
function testSingleValueObject<T extends Equatable<T>>(name: string, base: () => T, differing: () => T): void {
  test(`${name} は保持する 1 値で等価性が決まり、ハッシュがそれに追随する`, () => {
    assertEqualityContract(base, [["値", differing]]);
  });
}

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

const entityDeclaration = (name: string): EntityDeclaration =>
  EntityDeclaration.of({
    name: EntityName.of(name),
    element: ElementPath.of("entities[0]"),
    attrs: AttributeDeclarations.of([]),
    rels: RelationshipDeclarations.of([]),
  });

const entityReference = (entity: string): EntityReference =>
  EntityReference.of({
    entity: EntityName.of(entity),
    ownedBy: ComponentName.of("Sales"),
    element: ElementPath.of("components[0].entities[0].references[0]"),
  });

describe("単一値の値オブジェクト", () => {
  testSingleValueObject(
    "AllowedValue",
    () => AllowedValue.of("draft"),
    () => AllowedValue.of("published"),
  );
  testSingleValueObject(
    "BlockIndex",
    () => BlockIndex.of(1),
    () => BlockIndex.of(2),
  );
  testSingleValueObject(
    "BusinessRuleIdentifier",
    () => BusinessRuleIdentifier.of("BR1.1"),
    () => BusinessRuleIdentifier.of("BR1.2"),
  );
  testSingleValueObject(
    "CardinalityNotation",
    () => CardinalityNotation.of("1:N"),
    () => CardinalityNotation.of("N:1"),
  );
  testSingleValueObject(
    "CheckFamily",
    () => CheckFamily.of("DD-0"),
    () => CheckFamily.of("CD-1"),
  );
  testSingleValueObject(
    "ComponentName",
    () => ComponentName.of("Sales"),
    () => ComponentName.of("Shipping"),
  );
  testSingleValueObject(
    "ContractIdentifier",
    () => ContractIdentifier.of("C-1"),
    () => ContractIdentifier.of("C-2"),
  );
  testSingleValueObject(
    "ContractParty",
    () => ContractParty.of("sales"),
    () => ContractParty.of("billing"),
  );
  testSingleValueObject(
    "DesignRecordIdentifier",
    () => DesignRecordIdentifier.of(ArtifactPath.of("/review/design.md")),
    () => DesignRecordIdentifier.of(ArtifactPath.of("/review/other.md")),
  );
  testSingleValueObject(
    "ElementPath",
    () => ElementPath.of("entities[0]"),
    () => ElementPath.of("entities[1]"),
  );
  testSingleValueObject(
    "EntityName",
    () => EntityName.of("Order"),
    () => EntityName.of("Payment"),
  );
  testSingleValueObject(
    "LineNumber",
    () => LineNumber.of(12),
    () => LineNumber.of(13),
  );
  testSingleValueObject(
    "NumericBound",
    () => NumericBound.of(1.5),
    () => NumericBound.of(2.5),
  );
  testSingleValueObject(
    "ReferenceTarget",
    () => ReferenceTarget.of("Order.status"),
    () => ReferenceTarget.of("Order.total"),
  );
  testSingleValueObject(
    "RuleCategory",
    () => RuleCategory.of("validation"),
    () => RuleCategory.of("policy"),
  );
  testSingleValueObject(
    "SourceIdentifier",
    () => SourceIdentifier.of("FR-1"),
    () => SourceIdentifier.of("FR-2"),
  );
  testSingleValueObject(
    "StateName",
    () => StateName.of("draft"),
    () => StateName.of("paid"),
  );

  test("ContractParty はマークアップと前後の空白を落とした宣言で等価性が決まる", () => {
    const plain = ContractParty.of("Sales");
    for (const written of ["`Sales`", "**Sales**", "  Sales  ", " `**Sales**` "]) {
      const decorated = ContractParty.of(written);
      expect([written, plain.equals(decorated)]).toEqual([written, true]);
      expect([written, plain.hashCode() === decorated.hashCode()]).toEqual([written, true]);
    }
  });

  test("CardinalityNotation の等価性は宣言された表記そのもので、閉集合の判定だけが正規化を経る", () => {
    const upper = CardinalityNotation.of("1:N");
    const lower = CardinalityNotation.of("1:n");
    expect(upper.equals(lower)).toBe(false);
    expect(upper.isInClosedSet()).toBe(true);
    expect(lower.isInClosedSet()).toBe(true);
  });
});

describe("複数フィールドの値オブジェクト", () => {
  test("ComponentReference は参照先と宣言位置の対で等価性が決まる", () => {
    assertEqualityContract(
      () =>
        ComponentReference.of({
          component: ComponentName.of("Sales"),
          element: ElementPath.of("components[0].depends_on[0]"),
        }),
      [
        [
          "component",
          () =>
            ComponentReference.of({
              component: ComponentName.of("Shipping"),
              element: ElementPath.of("components[0].depends_on[0]"),
            }),
        ],
        [
          "element",
          () =>
            ComponentReference.of({
              component: ComponentName.of("Sales"),
              element: ElementPath.of("components[0].depends_on[1]"),
            }),
        ],
      ],
    );
  });

  test("EntityReference は参照先・所有成分・宣言位置の 3 つで等価性が決まる", () => {
    const base = {
      entity: EntityName.of("Order"),
      ownedBy: ComponentName.of("Sales"),
      element: ElementPath.of("components[0].entities[0].references[0]"),
    };
    assertEqualityContract(
      () => EntityReference.of(base),
      [
        ["entity", () => EntityReference.of({ ...base, entity: EntityName.of("Payment") })],
        ["ownedBy", () => EntityReference.of({ ...base, ownedBy: ComponentName.of("Shipping") })],
        [
          "element",
          () => EntityReference.of({ ...base, element: ElementPath.of("components[0].entities[0].references[1]") }),
        ],
      ],
    );
  });

  test("ShapeError は要素パスと文言の対で等価性が決まる", () => {
    const base = { element: ElementPath.of("entities[0]"), detail: "missing name" };
    assertEqualityContract(
      () => ShapeError.of(base),
      [
        ["element", () => ShapeError.of({ ...base, element: ElementPath.of("entities[1]") })],
        ["detail", () => ShapeError.of({ ...base, detail: "missing element" })],
      ],
    );
  });

  test("ComponentShapeError は要素パスと文言の対で等価性が決まる", () => {
    const base = { element: ElementPath.of("components[0]"), detail: "missing name" };
    assertEqualityContract(
      () => ComponentShapeError.of(base),
      [
        ["element", () => ComponentShapeError.of({ ...base, element: ElementPath.of("components[1]") })],
        ["detail", () => ComponentShapeError.of({ ...base, detail: "missing element" })],
      ],
    );
  });

  test("ComponentEntity は名前・位置・識別子・参照集合の 4 つで等価性が決まる", () => {
    const base = {
      name: EntityName.of("Order"),
      element: ElementPath.of("components[0].entities[0]"),
      identifier: AttributeName.of("orderId"),
      references: EntityReferences.of([entityReference("Customer")]),
    };
    assertEqualityContract(
      () => ComponentEntity.of(base),
      [
        ["name", () => ComponentEntity.of({ ...base, name: EntityName.of("Payment") })],
        ["element", () => ComponentEntity.of({ ...base, element: ElementPath.of("components[0].entities[1]") })],
        ["identifier", () => ComponentEntity.of({ ...base, identifier: AttributeName.of("paymentId") })],
        ["identifier が無い", () => ComponentEntity.of({ ...base, identifier: null })],
        [
          "references",
          () => ComponentEntity.of({ ...base, references: EntityReferences.of([entityReference("Invoice")]) }),
        ],
      ],
    );
  });

  test("識別子を持たない ComponentEntity 同士は等しい", () => {
    const withoutIdentifier = (): ComponentEntity =>
      ComponentEntity.of({
        name: EntityName.of("Order"),
        element: ElementPath.of("components[0].entities[0]"),
        identifier: null,
        references: EntityReferences.of([]),
      });
    expect(withoutIdentifier().equals(withoutIdentifier())).toBe(true);
    expect(withoutIdentifier().hashCode()).toBe(withoutIdentifier().hashCode());
  });

  test("ContractRow は契約 id・3 者・行番号の 5 つで等価性が決まる", () => {
    const base = {
      id: ContractIdentifier.of("C-1"),
      provider: ContractParty.of("sales"),
      consumer: ContractParty.of("billing"),
      owner: ContractParty.of("platform"),
      line: LineNumber.of(12),
    };
    assertEqualityContract(
      () => ContractRow.of(base),
      [
        ["id", () => ContractRow.of({ ...base, id: ContractIdentifier.of("C-2") })],
        ["provider", () => ContractRow.of({ ...base, provider: ContractParty.of("shipping") })],
        ["consumer", () => ContractRow.of({ ...base, consumer: ContractParty.of("shipping") })],
        ["owner", () => ContractRow.of({ ...base, owner: ContractParty.of("shipping") })],
        ["line", () => ContractRow.of({ ...base, line: LineNumber.of(13) })],
      ],
    );
  });

  test("RelationshipDeclaration は位置・両端・基数・方向の有無の 5 つで等価性が決まる", () => {
    const base = {
      element: ElementPath.of("entities[0].relationships[0]"),
      from: EntityName.of("Order"),
      to: EntityName.of("Customer"),
      cardinality: CardinalityNotation.of("1:N"),
      hasDirection: true,
    };
    assertEqualityContract(
      () => RelationshipDeclaration.of(base),
      [
        [
          "element",
          () => RelationshipDeclaration.of({ ...base, element: ElementPath.of("entities[0].relationships[1]") }),
        ],
        ["from", () => RelationshipDeclaration.of({ ...base, from: EntityName.of("Payment") })],
        ["from が無い", () => RelationshipDeclaration.of({ ...base, from: null })],
        ["to", () => RelationshipDeclaration.of({ ...base, to: EntityName.of("Payment") })],
        ["to が無い", () => RelationshipDeclaration.of({ ...base, to: null })],
        ["cardinality", () => RelationshipDeclaration.of({ ...base, cardinality: CardinalityNotation.of("N:1") })],
        ["cardinality が無い", () => RelationshipDeclaration.of({ ...base, cardinality: null })],
        ["hasDirection", () => RelationshipDeclaration.of({ ...base, hasDirection: false })],
      ],
    );
  });

  test("UnitDeclaration はユニット名と依存先集合の対で等価性が決まる", () => {
    const base = { name: UnitName.of("sales"), dependsOn: UnitNames.of([UnitName.of("billing")]) };
    assertEqualityContract(
      () => UnitDeclaration.of(base),
      [
        ["name", () => UnitDeclaration.of({ ...base, name: UnitName.of("shipping") })],
        ["dependsOn", () => UnitDeclaration.of({ ...base, dependsOn: UnitNames.of([UnitName.of("platform")]) })],
        ["dependsOn が空", () => UnitDeclaration.of({ ...base, dependsOn: UnitNames.of([]) })],
      ],
    );
  });

  test("SiblingUnitIndexEntry は所有ユニットと宣言集合の対で等価性が決まる", () => {
    assertEqualityContract(
      () => SiblingUnitIndexEntry.of(UnitName.of("sales"), EntityDeclarations.of([entityDeclaration("Order")])),
      [
        [
          "unit",
          () => SiblingUnitIndexEntry.of(UnitName.of("shipping"), EntityDeclarations.of([entityDeclaration("Order")])),
        ],
        [
          "declarations",
          () => SiblingUnitIndexEntry.of(UnitName.of("sales"), EntityDeclarations.of([entityDeclaration("Payment")])),
        ],
      ],
    );
  });

  test("ReferenceCheckReportIdentifier は配置ディレクトリと backend 名の対で等価性が決まる", () => {
    assertEqualityContract(
      () => ReferenceCheckReportIdentifier.of(ArtifactPath.of("/review"), "functional-design"),
      [
        ["directory", () => ReferenceCheckReportIdentifier.of(ArtifactPath.of("/other"), "functional-design")],
        ["backend", () => ReferenceCheckReportIdentifier.of(ArtifactPath.of("/review"), "domain-design")],
      ],
    );
  });

  test("InputAnchor は成果物名と sha256 の対で等価性が決まる", () => {
    const base = { artifact: "components.md", sha256: ContentHash.of(SHA_A) };
    assertEqualityContract(
      () => InputAnchor.of(base),
      [
        ["artifact", () => InputAnchor.of({ ...base, artifact: "entities.md" })],
        ["sha256", () => InputAnchor.of({ ...base, sha256: ContentHash.of(SHA_B) })],
      ],
    );
  });
});

describe("StateMachineSketch の判別共用体", () => {
  const declared = {
    spec: MachineSpecification.of("Order.status"),
    states: StateNames.of([StateName.of("draft"), StateName.of("paid")]),
    fenceLine: LineNumber.of(7),
    unsupported: null,
  };

  test("declared は spec・状態集合・フェンス行・支持外理由の 4 つで等価性が決まる", () => {
    assertEqualityContract(
      () => StateMachineSketch.of(declared),
      [
        ["spec", () => StateMachineSketch.of({ ...declared, spec: MachineSpecification.of("Payment.status") })],
        ["states", () => StateMachineSketch.of({ ...declared, states: StateNames.of([StateName.of("draft")]) })],
        ["fenceLine", () => StateMachineSketch.of({ ...declared, fenceLine: LineNumber.of(8) })],
        ["unsupported", () => StateMachineSketch.of({ ...declared, unsupported: "nested state diagram" })],
      ],
    );
  });

  test("unrecognized は見出し行と理由の対で等価性が決まる", () => {
    assertEqualityContract(
      () => StateMachineSketch.unrecognized(LineNumber.of(3), ErrorMessage.of("heading not recognized")),
      [
        ["line", () => StateMachineSketch.unrecognized(LineNumber.of(4), ErrorMessage.of("heading not recognized"))],
        ["reason", () => StateMachineSketch.unrecognized(LineNumber.of(3), ErrorMessage.of("fence not closed"))],
      ],
    );
  });

  test("種別が違えば等しくなく、ハッシュにも種別が畳み込まれる", () => {
    const asDeclared = StateMachineSketch.of(declared);
    const asUnrecognized = StateMachineSketch.unrecognized(LineNumber.of(7), ErrorMessage.of("heading not recognized"));
    expect(asDeclared.equals(asUnrecognized)).toBe(false);
    expect(asUnrecognized.equals(asDeclared)).toBe(false);
    expect(asDeclared.hashCode()).not.toBe(asUnrecognized.hashCode());
  });
});

describe("Skipped の等価性と凍結描画", () => {
  const base = {
    target: TargetIdentifier.of("check:DD-0"),
    reason: SkipReason.waived(),
    unit: UnitName.of("sales"),
    detail: "waived by owner",
  };

  test("Skipped は対象・理由・帰属ユニット・説明の 4 つで等価性が決まる", () => {
    assertEqualityContract(
      () => Skipped.of(base),
      [
        ["target", () => Skipped.of({ ...base, target: TargetIdentifier.of("check:CD-1") })],
        ["reason", () => Skipped.of({ ...base, reason: SkipReason.timeout() })],
        ["unit", () => Skipped.of({ ...base, unit: UnitName.of("shipping") })],
        ["unit が無い", () => Skipped.of({ ...base, unit: undefined })],
        ["detail", () => Skipped.of({ ...base, detail: "waived by policy" })],
        ["detail が無い", () => Skipped.of({ ...base, detail: undefined })],
      ],
    );
  });

  test("任意欄を持たない Skipped 同士は等しい", () => {
    const minimal = (): Skipped =>
      Skipped.of({ target: TargetIdentifier.of("check:DD-0"), reason: SkipReason.waived() });
    expect(minimal().equals(minimal())).toBe(true);
    expect(minimal().hashCode()).toBe(minimal().hashCode());
  });

  test("toDocument は (target, reason, detail?, unit?) の順で凍結された行を描く", () => {
    const full = Skipped.of(base).toDocument();
    expect(Object.keys(full)).toEqual(["target", "reason", "detail", "unit"]);
    expect(full).toEqual({ target: "check:DD-0", reason: "waived", detail: "waived by owner", unit: "sales" });

    const minimal = Skipped.of({ target: base.target, reason: base.reason }).toDocument();
    expect(Object.keys(minimal)).toEqual(["target", "reason"]);
    expect(minimal).toEqual({ target: "check:DD-0", reason: "waived" });

    const detailOnly = Skipped.of({ target: base.target, reason: base.reason, detail: "waived by owner" }).toDocument();
    expect(Object.keys(detailOnly)).toEqual(["target", "reason", "detail"]);

    const unitOnly = Skipped.of({ target: base.target, reason: base.reason, unit: UnitName.of("sales") }).toDocument();
    expect(Object.keys(unitOnly)).toEqual(["target", "reason", "unit"]);
    expect(unitOnly).toEqual({ target: "check:DD-0", reason: "waived", unit: "sales" });
  });
});

describe("Finding の等価性と凍結描画", () => {
  const witness = (element: string): WitnessReferences =>
    WitnessReferences.of([WitnessReference.at("components.md", element)]);
  const base = {
    kind: FindingKind.of("structure-invalid"),
    functionalRequirementReferences: FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]),
    targets: FindingTargets.of(TargetIdentifier.of("check:DD-0"), []),
    witness: { refs: witness("components[0]") },
    unit: UnitName.of("sales"),
    detail: "DD-0: shape invalid",
  };

  test("Finding は kind・要件参照・対象・witness・帰属ユニット・説明の 6 つで等価性が決まる", () => {
    assertEqualityContract(
      () => Finding.of(base),
      [
        ["kind", () => Finding.of({ ...base, kind: FindingKind.of("reference-broken") })],
        [
          "functionalRequirementReferences",
          () =>
            Finding.of({
              ...base,
              functionalRequirementReferences: FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-2")]),
            }),
        ],
        ["targets", () => Finding.of({ ...base, targets: FindingTargets.of(TargetIdentifier.of("check:CD-1"), []) })],
        ["witness", () => Finding.of({ ...base, witness: { refs: witness("components[1]") } })],
        ["unit", () => Finding.of({ ...base, unit: UnitName.of("shipping") })],
        ["unit が無い", () => Finding.of({ ...base, unit: undefined })],
        ["detail", () => Finding.of({ ...base, detail: "DD-0: element missing" })],
      ],
    );
  });

  test("witnessRefs は構築時に渡した参照列をそのまま返す", () => {
    const refs = witness("components[0]");
    expect(
      Finding.of({ ...base, witness: { refs } })
        .witnessRefs()
        .equals(refs),
    ).toBe(true);
  });

  test("toDocument は (kind, frRefs, targets, witness, detail, unit?) の順で凍結された行を描く", () => {
    const full = Finding.of(base).toDocument();
    expect(Object.keys(full)).toEqual(["kind", "frRefs", "targets", "witness", "detail", "unit"]);
    expect(full).toEqual({
      kind: "structure-invalid",
      frRefs: ["FR-1"],
      targets: ["check:DD-0"],
      witness: { refs: [{ artifact: "components.md", element: "components[0]" }] },
      detail: "DD-0: shape invalid",
      unit: "sales",
    });

    const withoutUnit = Finding.of({ ...base, unit: undefined }).toDocument();
    expect(Object.keys(withoutUnit)).toEqual(["kind", "frRefs", "targets", "witness", "detail"]);
  });
});

describe("WitnessReference の等価性と凍結描画", () => {
  const base = { artifact: "components.md", element: "components[0]", value: "Sales" };

  test("WitnessReference は成果物・要素パス・値の 3 つで等価性が決まる", () => {
    assertEqualityContract(
      () => WitnessReference.of(base),
      [
        ["artifact", () => WitnessReference.of({ ...base, artifact: "entities.md" })],
        ["element", () => WitnessReference.of({ ...base, element: "components[1]" })],
        ["value", () => WitnessReference.of({ ...base, value: "Shipping" })],
        ["value が無い", () => WitnessReference.of({ ...base, value: undefined })],
      ],
    );
  });

  test("toDocument は (artifact, element, value?) の順で凍結された行を描く", () => {
    const full = WitnessReference.of(base).toDocument();
    expect(Object.keys(full)).toEqual(["artifact", "element", "value"]);
    expect(full).toEqual({ artifact: "components.md", element: "components[0]", value: "Sales" });

    const withoutValue = WitnessReference.at("components.md", "components[0]").toDocument();
    expect(Object.keys(withoutValue)).toEqual(["artifact", "element"]);
    expect(withoutValue).toEqual({ artifact: "components.md", element: "components[0]" });
  });
});

describe("InputAnchor の凍結描画と成果物名順", () => {
  test("toDocument は (artifact, sha256) の順で凍結された行を描く", () => {
    const document = InputAnchor.of({ artifact: "components.md", sha256: ContentHash.of(SHA_A) }).toDocument();
    expect(Object.keys(document)).toEqual(["artifact", "sha256"]);
    expect(document).toEqual({ artifact: "components.md", sha256: SHA_A });
  });

  test("compareByArtifact は成果物名だけで順序を決め、sha256 は順序に効かない", () => {
    const components = InputAnchor.of({ artifact: "components.md", sha256: ContentHash.of(SHA_B) });
    const entities = InputAnchor.of({ artifact: "entities.md", sha256: ContentHash.of(SHA_A) });
    expect(components.compareByArtifact(entities)).toBe(-1);
    expect(entities.compareByArtifact(components)).toBe(1);
    // 同じ成果物名なら、内容が違っても順序は付かない（inputs[] の並びは成果物名順）。
    expect(
      components.compareByArtifact(InputAnchor.of({ artifact: "components.md", sha256: ContentHash.of(SHA_A) })),
    ).toBe(0);
  });

  test("artifact と sha256 は構築時の値をそのまま返す", () => {
    const anchor = InputAnchor.of({ artifact: "components.md", sha256: ContentHash.of(SHA_A) });
    expect(anchor.artifact()).toBe("components.md");
    expect(anchor.sha256().asString()).toBe(SHA_A);
  });
});
