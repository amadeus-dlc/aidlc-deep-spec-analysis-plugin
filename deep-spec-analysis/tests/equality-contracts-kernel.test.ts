import { describe, expect, test } from "bun:test";
import {
  ArtifactPath,
  AttributeBound,
  AttributePath,
  BackendName,
  BindingDeclaration,
  BindingValue,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  EnumerationMember,
  ErrorMessage,
  IntermediateRepresentationVersion,
  NormalizedName,
  QueryLabel,
  RequirementIdentifier,
  ScenarioBinding,
  TriggerName,
  UnitName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";

// このファイルは kernel/domain の全 DP・小さなエンティティが守る equals/hashCode
// 契約を表明する。「等しい値は必ず等しいハッシュ（逆は要求しない）」「同じ値は
// 何度呼んでも同じハッシュ（決定的）」を、値の同一性を実際に動かして検査する。
// カバレッジを埋めるためだけの呼びっぱなしテストは置かない。

describe("ArtifactPath", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = ArtifactPath.of("/x/y.md");
    const same = ArtifactPath.of("/x/y.md");
    const other = ArtifactPath.of("/x/z.md");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("AttributeBound", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = AttributeBound.of(10);
    const same = AttributeBound.of(10);
    const other = AttributeBound.of(11);

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("AttributePath", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = AttributePath.of("Entity.attr1");
    const same = AttributePath.of("Entity.attr1");
    const other = AttributePath.of("Entity.attr2");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("BackendName", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = BackendName.of("quint");
    const same = BackendName.of("quint");
    const other = BackendName.of("smt");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("BindingDeclaration", () => {
  const declaredValue = (raw: boolean) => DeclaredBindingValue.of(Declaration.of(raw));

  test("等価性とハッシュは path と value の両方をペアで見る", () => {
    const a = BindingDeclaration.of(AttributePath.of("Entity.attr1"), declaredValue(true));
    const same = BindingDeclaration.of(AttributePath.of("Entity.attr1"), declaredValue(true));
    // path だけを変えた相手
    const diffPath = BindingDeclaration.of(AttributePath.of("Entity.attr2"), declaredValue(true));
    // value だけを変えた相手
    const diffValue = BindingDeclaration.of(AttributePath.of("Entity.attr1"), declaredValue(false));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffPath)).toBe(false);
    expect(a.equals(diffValue)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("BindingValue", () => {
  test("等価性とハッシュは bool / int / enum の3分岐すべてで対になる", () => {
    const boolA = BindingValue.of(true);
    const boolSame = BindingValue.of(true);
    const boolOther = BindingValue.of(false);
    expect(boolA.equals(boolSame)).toBe(true);
    expect(boolA.equals(boolOther)).toBe(false);
    expect(boolA.hashCode()).toBe(boolSame.hashCode());
    expect(boolA.hashCode()).toBe(boolA.hashCode());

    const intA = BindingValue.of(42);
    const intSame = BindingValue.of(42);
    const intOther = BindingValue.of(43);
    expect(intA.equals(intSame)).toBe(true);
    expect(intA.equals(intOther)).toBe(false);
    expect(intA.hashCode()).toBe(intSame.hashCode());
    expect(intA.hashCode()).toBe(intA.hashCode());

    const enumA = BindingValue.of("Active");
    const enumSame = BindingValue.of("Active");
    const enumOther = BindingValue.of("Inactive");
    expect(enumA.equals(enumSame)).toBe(true);
    expect(enumA.equals(enumOther)).toBe(false);
    expect(enumA.hashCode()).toBe(enumSame.hashCode());
    expect(enumA.hashCode()).toBe(enumA.hashCode());

    // 分岐をまたぐと値として等しくならない（内部は === 比較）
    expect(boolA.equals(intA)).toBe(false);
  });
});

describe("ContentHash", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = ContentHash.of("a".repeat(64));
    const same = ContentHash.of("a".repeat(64));
    const other = ContentHash.of("b".repeat(64));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("Declaration", () => {
  test("等価性はキー順を無視し、ハッシュは正準化した表現から作られるので対で成り立つ", () => {
    const a = Declaration.of({ x: 1, y: 2 });
    // 内容は同じでキー順だけが違う
    const sameContentDifferentKeyOrder = Declaration.of({ y: 2, x: 1 });
    const different = Declaration.of({ x: 1, y: 3 });

    expect(a.equals(sameContentDifferentKeyOrder)).toBe(true);
    expect(a.equals(different)).toBe(false);
    // canonicalStringify がキーを整列するので、キー順違いでもハッシュは一致する
    expect(a.hashCode()).toBe(sameContentDifferentKeyOrder.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("DeclaredBindingValue", () => {
  test("等価性とハッシュは内部の Declaration に委譲され対で成り立つ", () => {
    const a = DeclaredBindingValue.of(Declaration.of(42));
    const same = DeclaredBindingValue.of(Declaration.of(42));
    const other = DeclaredBindingValue.of(Declaration.of(43));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("DeclaredBindings", () => {
  const binding = (path: string, value: boolean | number | string) =>
    BindingDeclaration.of(AttributePath.of(path), DeclaredBindingValue.of(Declaration.of(value)));

  test("combine は左のあとに右を並べた新しいコレクションを返し、元は変えない", () => {
    const left = DeclaredBindings.of([binding("Entity.a", true)]);
    const right = DeclaredBindings.of([binding("Entity.b", 1)]);

    const combined = left.combine(right);

    expect(combined.count()).toBe(2);
    const combinedValues = combined.toArray();
    expect(combinedValues[0]?.equals(binding("Entity.a", true))).toBe(true);
    expect(combinedValues[1]?.equals(binding("Entity.b", 1))).toBe(true);
    // 元のコレクションは不変
    expect(left.count()).toBe(1);
    expect(right.count()).toBe(1);
  });

  test("matchesVerbatim は要素の equals（キー順非依存）より厳しい逐語一致を要求する", () => {
    const keyOrderA = Declaration.of({ x: 1, y: 2 });
    const keyOrderB = Declaration.of({ y: 2, x: 1 });
    // 前提: 要素自身の equals はキー順を無視するので等しい
    expect(keyOrderA.equals(keyOrderB)).toBe(true);

    const left = DeclaredBindings.of([
      BindingDeclaration.of(AttributePath.of("Entity.a"), DeclaredBindingValue.of(keyOrderA)),
    ]);
    const rightSameElementsEquals = DeclaredBindings.of([
      BindingDeclaration.of(AttributePath.of("Entity.a"), DeclaredBindingValue.of(keyOrderB)),
    ]);
    // 要素の equals では等しい2束縛でも、逐語（JSON文字列一致）では区別する
    expect(left.matchesVerbatim(rightSameElementsEquals)).toBe(false);

    const verbatimSame = DeclaredBindings.of([
      BindingDeclaration.of(AttributePath.of("Entity.a"), DeclaredBindingValue.of(Declaration.of({ x: 1, y: 2 }))),
    ]);
    expect(left.matchesVerbatim(verbatimSame)).toBe(true);

    // matchesVerbatim と対のハッシュ
    expect(left.verbatimHashCode()).toBe(verbatimSame.verbatimHashCode());
    expect(left.verbatimHashCode()).toBe(left.verbatimHashCode());
  });
});

describe("EnumerationMember", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = EnumerationMember.of("Active");
    const same = EnumerationMember.of("Active");
    const other = EnumerationMember.of("Inactive");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("ErrorMessage", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = ErrorMessage.of("boom");
    const same = ErrorMessage.of("boom");
    const other = ErrorMessage.of("bang");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("IntermediateRepresentationVersion", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = IntermediateRepresentationVersion.of("1.0.0");
    const same = IntermediateRepresentationVersion.of("1.0.0");
    const other = IntermediateRepresentationVersion.of("1.0.1");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("NormalizedName", () => {
  test("正規化後の値が等しければ等価かつ同じハッシュになる", () => {
    // 大文字小文字・区切り文字は正規化で吸収されるので、生の表記が違っても等しい
    const a = NormalizedName.of("OrderItem");
    const same = NormalizedName.of("order_item");
    const other = NormalizedName.of("OrderLine");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("QueryLabel", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = QueryLabel.of("solver:query-1");
    const same = QueryLabel.of("solver:query-1");
    const other = QueryLabel.of("solver:query-2");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("RequirementIdentifier", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = RequirementIdentifier.of("FR-1");
    const same = RequirementIdentifier.of("FR-1");
    const other = RequirementIdentifier.of("FR-2");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("ScenarioBinding", () => {
  test("等価性とハッシュは path と value の両方をペアで見る", () => {
    const a = ScenarioBinding.of(AttributePath.of("Entity.attr1"), BindingValue.of(true));
    const same = ScenarioBinding.of(AttributePath.of("Entity.attr1"), BindingValue.of(true));
    // path だけを変えた相手
    const diffPath = ScenarioBinding.of(AttributePath.of("Entity.attr2"), BindingValue.of(true));
    // value だけを変えた相手
    const diffValue = ScenarioBinding.of(AttributePath.of("Entity.attr1"), BindingValue.of(false));

    expect(a.equals(same)).toBe(true);
    expect(a.equals(diffPath)).toBe(false);
    expect(a.equals(diffValue)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("TriggerName", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = TriggerName.of("OrderPlaced");
    const same = TriggerName.of("OrderPlaced");
    const other = TriggerName.of("OrderCancelled");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("UnitName", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = UnitName.of("billing-unit");
    const same = UnitName.of("billing-unit");
    const other = UnitName.of("shipping-unit");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});

describe("VerificationMethod", () => {
  test("等価性とハッシュは対で成り立つ", () => {
    const a = VerificationMethod.of("bounded");
    const same = VerificationMethod.of("bounded");
    const other = VerificationMethod.of("static");

    expect(a.equals(same)).toBe(true);
    expect(a.equals(other)).toBe(false);
    expect(a.hashCode()).toBe(same.hashCode());
    expect(a.hashCode()).toBe(a.hashCode());
  });
});
