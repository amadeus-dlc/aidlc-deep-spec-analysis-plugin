import { describe, expect, test } from "bun:test";
import {
  BusinessRuleReference,
  DesignBackgroundIdentifier,
  DesignMachineIdentifier,
  DesignObligationIdentifier,
  DesignScenarioIdentifier,
  DesignTransitionIdentifier,
} from "@deep-spec/design-domain";
import { PluginVersion } from "@deep-spec/doctor-domain";
import {
  AttributeBound,
  AttributeKind,
  BindingValue,
  ContentHash,
  Declaration,
  DeclaredBindingValue,
  DeclaredBound,
  DeclaredDigest,
  FindingKind,
  IntermediateRepresentationVersion,
  RequirementIdentifier,
  SkipReason,
  TargetIdentifier,
  VerificationMethod,
} from "@deep-spec/kernel-domain";
import { IllegalArgumentException, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import {
  BlockIndex,
  BusinessRuleIdentifier,
  CardinalityNotation,
  ContractParty,
  FenceCount,
  LineNumber,
  NumericBound,
} from "@deep-spec/refcheck-domain";
import {
  BackgroundAssumptionIdentifier,
  ObligationIdentifier,
  ScenarioIdentifier,
  SourceAnchor,
} from "@deep-spec/requirements-domain";

// 型違反を偽造せず、同じ型の契約違反値を通常生成と再構成の両方へ渡す。
function rejects<R>(factory: { of(value: R): object; parse(value: R): Result<object, ParseError> }, value: R): void {
  expect(() => factory.of(value)).toThrow(IllegalArgumentException);
  const parsed = factory.parse(value);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) {
    expect(parsed.error).not.toBeInstanceOf(Error);
    expect(parsed.error.kind.length).toBeGreaterThan(0);
  }
}

describe("オリジン: 値単体の保証と境界の責務", () => {
  // ContentHashは送信元の認証情報を持たない。以下は内容の整合性の検証であり、
  // 正当な送信元であることの証明にはしない。送信元認証の代用品をVOへ作らない。
  test("宣言されたダイジェストを、独立に計算した取得内容と照合する", () => {
    const original = ContentHash.ofBytes(new TextEncoder().encode("original source"));
    const declared = DeclaredDigest.of(original.asString());
    expect(SourceAnchor.of(declared, original).errors()).toEqual([]);
    const changed = ContentHash.ofBytes(new TextEncoder().encode("changed source"));
    expect(SourceAnchor.of(declared, changed).errors()).toHaveLength(1);
  });

  test("形式上有効な自己申告のハッシュを、内容一致や送信元認証と混同しない", () => {
    const claimed = ContentHash.parse("0".repeat(64));
    expect(claimed.ok).toBe(true);
    if (claimed.ok) expect(claimed.value.equals(ContentHash.ofText("original source"))).toBe(false);
  });
});

describe("サイズ: 字句・構文の検査に先行する", () => {
  test("長大かつ字句不正のIDは、まずサイズ違反になる", () => {
    const raw = "\u0000".repeat(129);
    rejects(RequirementIdentifier, raw);
    expect(RequirementIdentifier.parse(raw)).toEqual({
      ok: false,
      error: { kind: "requirement-id-too-long", raw: 129 },
    });
  });

  test("ハッシュは63・64・65コード単位の境界を守る", () => {
    rejects(ContentHash, "a".repeat(63));
    expect(ContentHash.parse("a".repeat(64)).ok).toBe(true);
    rejects(ContentHash, "a".repeat(65));
  });
});

const numberedIds = [
  ["ObligationIdentifier", ObligationIdentifier, "OB"],
  ["ScenarioIdentifier", ScenarioIdentifier, "SC"],
  ["BackgroundAssumptionIdentifier", BackgroundAssumptionIdentifier, "BG"],
  ["DesignObligationIdentifier", DesignObligationIdentifier, "DOB"],
  ["DesignScenarioIdentifier", DesignScenarioIdentifier, "DSC"],
  ["DesignBackgroundIdentifier", DesignBackgroundIdentifier, "DBG"],
  ["DesignMachineIdentifier", DesignMachineIdentifier, "SM"],
  ["DesignTransitionIdentifier", DesignTransitionIdentifier, "TR"],
] as const;

describe("字句的内容: 許容文字とエンコーディング", () => {
  test("ContentHashは同じ64コード単位でも不正な文字を拒否する", () => {
    for (const char of ["g", "A", "ａ", "\u0000", "\n", "\u200b", "\ud800"]) {
      rejects(ContentHash, "a".repeat(63) + char);
    }
  });
  for (const [name, factory, prefix] of numberedIds) {
    test(`${name}は数字の見た目が似た別文字や制御文字を拒否する`, () => {
      for (const suffix of ["１", "١", "\u200b1", "1\u0000", "1\n", "\ud800"]) rejects(factory, `${prefix}-${suffix}`);
    });
  }
  test("要件・規則IDとバージョンも非ASCII数字を数字として扱わない", () => {
    rejects(RequirementIdentifier, "FR-１");
    rejects(BusinessRuleReference, "BR1.１");
    rejects(BusinessRuleIdentifier, "BR１.1");
    rejects(IntermediateRepresentationVersion, "1.０.0");
    rejects(PluginVersion, "1.0.１");
  });
});

describe("構文: 正当な文字だけでも組み合わせが不正なら拒否する", () => {
  for (const [name, factory, prefix] of numberedIds) {
    test(`${name}の接頭辞・区切り・数値部分を検査する`, () => {
      expect(factory.parse(`${prefix}-12`).ok).toBe(true);
      for (const raw of [`${prefix}12`, `${prefix}--12`, `${prefix}-`, `${prefix}-1.2`, "XX-12"]) rejects(factory, raw);
    });
  }
  test("要件参照と業務規則参照の構造を区別する", () => {
    for (const raw of ["FR--1", "FR-1..2", "FR-.1", "FR-1."]) rejects(RequirementIdentifier, raw);
    for (const factory of [BusinessRuleReference, BusinessRuleIdentifier])
      for (const raw of ["BR-1.1", "BR1", "BR1..1", "BR1.1.1"]) rejects(factory, raw);
    rejects(TargetIdentifier, "component:");
    rejects(TargetIdentifier, "OB_1");
  });
  test("バージョンの構文契約と正規化の有無を区別する", () => {
    for (const raw of ["1.2", "1.2.3.4", "1..3", ".1.2"]) {
      rejects(IntermediateRepresentationVersion, raw);
      rejects(PluginVersion, raw);
    }
    rejects(PluginVersion, "01.2.3");
    rejects(PluginVersion, "1.2.3-beta");
    expect(IntermediateRepresentationVersion.parse("01.2.3").ok).toBe(true);
    const tag = PluginVersion.parse("v1.2.3");
    expect(tag.ok && tag.value.asString()).toBe("1.2.3");
  });
});

describe("意味: 値域・所属・値同士の関係", () => {
  test("正当な英字トークンでも閉じた語彙集合に属さなければ拒否する", () => {
    rejects(VerificationMethod, "manual");
    rejects(SkipReason, "ignored");
    rejects(FindingKind, "warning");
    expect(VerificationMethod.parse("static").ok).toBe(true);
    expect(SkipReason.parse("waived").ok).toBe(true);
  });
  test("安全な整数境界と実数境界の意味を混同しない", () => {
    for (const value of [
      Number.NaN,
      Infinity,
      -Infinity,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.MIN_SAFE_INTEGER - 1,
    ])
      rejects(AttributeBound, value);
    expect(AttributeBound.parse(Number.MAX_SAFE_INTEGER).ok).toBe(true);
    expect(AttributeBound.parse(Number.MIN_SAFE_INTEGER).ok).toBe(true);
    expect(NumericBound.parse(0.5).ok).toBe(true);
    for (const value of [Number.NaN, Infinity, -Infinity]) rejects(NumericBound, value);
    expect(AttributeBound.of(2).exceeds(AttributeBound.of(1))).toBe(true);
    expect(AttributeBound.of(1).exceeds(AttributeBound.of(1))).toBe(false);
  });
  test("行番号とブロック位置は正の安全整数である", () => {
    for (const factory of [LineNumber, BlockIndex]) {
      expect(factory.parse(1).ok).toBe(true);
      expect(factory.parse(Number.MAX_SAFE_INTEGER).ok).toBe(true);
      for (const value of [0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) rejects(factory, value);
    }
  });
  test("個数・論理整数もnumberのままofとparseの失敗を分ける", () => {
    expect(FenceCount.parse(0).ok).toBe(true);
    expect(FenceCount.parse(Number.MAX_SAFE_INTEGER).ok).toBe(true);
    for (const value of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) rejects(FenceCount, value);
    for (const value of [0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) rejects(BindingValue, value);
    expect(BindingValue.parse(Number.MIN_SAFE_INTEGER).ok).toBe(true);
    expect(BindingValue.parse(Number.MAX_SAFE_INTEGER).ok).toBe(true);
  });
  test("宣言境界のparse成功と、安全整数の意味的適合を区別する", () => {
    const declared = DeclaredBound.parse(0.5);
    expect(declared.ok).toBe(true);
    if (declared.ok) {
      expect(declared.value.asNumber()).toBe(0.5);
      expect(declared.value.isSafeInteger()).toBe(false);
    }
    expect(DeclaredBound.parse(1).ok).toBe(true);
  });
  test("診断用の宣言値は、不適合な記述を検証済みの値に昇格させない", () => {
    const declaration = Declaration.parse(1.5);
    expect(declaration.ok).toBe(true);
    if (declaration.ok) {
      expect(DeclaredBindingValue.of(declaration.value).fits(AttributeKind.of("int"), () => false)).toBe(false);
      expect(BindingValue.resolve(DeclaredBindingValue.of(declaration.value)).ok).toBe(false);
    }
    const member = Declaration.parse("closed");
    expect(member.ok).toBe(true);
    if (member.ok) {
      expect(DeclaredBindingValue.of(member.value).fits(AttributeKind.of("enum"), (value) => value === "open")).toBe(
        false,
      );
      expect(DeclaredBindingValue.of(member.value).fits(AttributeKind.of("enum"), (value) => value === "closed")).toBe(
        true,
      );
    }
  });
  test("多重度の宣言と契約当事者は意味のある照合を持つ", () => {
    expect(CardinalityNotation.of("1 : n").isInClosedSet()).toBe(true);
    expect(CardinalityNotation.of("1:X").isInClosedSet()).toBe(false);
    expect(ContractParty.of("**External: Payments**").declaresExternal()).toBe(true);
    expect(ContractParty.of("Internal").declaresExternal()).toBe(false);
    expect(ContractParty.of("  ").isBlank()).toBe(true);
  });
});
