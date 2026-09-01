import type { AttrDeclSeed } from "./attr-decl-seed.ts";
import { type AttributeDefault } from "./attribute-default.ts";
import { type AttributeName } from "./attribute-name.ts";
import { type ElementPath } from "./element-path.ts";
import { type NumericBound } from "./numeric-bound.ts";
import { type ReferenceTarget } from "./reference-target.ts";
import { type StateNames } from "./state-names.ts";

// 属性宣言。型区分との整合・範囲と既定値の整合・ライフサイクル候補性という
// ドメイン知識を自分で判定する（旧 FD-E2/E3 の条件式の移設）。
export class AttrDecl {
  readonly #seed: AttrDeclSeed;

  private constructor(seed: AttrDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: AttrDeclSeed): AttrDecl {
    return new AttrDecl(seed);
  }

  name(): AttributeName {
    return this.#seed.name;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  references(): ReferenceTarget | null {
    return this.#seed.references;
  }

  def(): AttributeDefault | null {
    return this.#seed.def;
  }

  min(): NumericBound | null {
    return this.#seed.min;
  }

  max(): NumericBound | null {
    return this.#seed.max;
  }

  hasAllowedValues(): boolean {
    return this.#seed.allowed !== null;
  }

  // 境界: witness の location value に載る型トークン（未宣言は ""——凍結形）。
  typeToken(): string {
    return this.#seed.type === null ? "" : this.#seed.type.normalized();
  }

  // 境界: 文言に載る型の描画形（未宣言は旧 `${null}` の "null"——凍結形）。
  typeText(): string {
    return this.#seed.type === null ? "null" : this.#seed.type.asString();
  }

  // FD-E2: 列挙できない型区分（数値・日付・真偽）に allowed_values を宣言。
  declaresAllowedValuesOnNonEnumerableType(): boolean {
    const t = this.#seed.type;
    if (t === null || this.#seed.allowed === null) return false;
    return t.classifiesNumeric() || t.classifiesDate() || t.classifiesBool();
  }

  // FD-E2: 数値・日付でない型に min/max を宣言（型未宣言は FD-E2 の対象外——凍結）。
  declaresBoundsOnNonNumericType(): boolean {
    const t = this.#seed.type;
    if (!(this.#seed.minDeclared || this.#seed.maxDeclared)) return false;
    if (t === null || t.normalized() === "") return false;
    return !t.classifiesNumeric() && !t.classifiesDate();
  }

  // FD-E2: コレクション型に unique を宣言。
  declaresUniqueOnCollectionType(): boolean {
    return this.#seed.uniqueIsTrue && this.#seed.type !== null && this.#seed.type.classifiesCollection();
  }

  // FD-E3: min > max の範囲逆転。
  boundsInverted(): boolean {
    return this.#seed.min !== null && this.#seed.max !== null && this.#seed.min.exceeds(this.#seed.max);
  }

  // FD-E3: 数値既定値が範囲の外。
  defaultBelowMin(): boolean {
    const d = this.#seed.def;
    return d !== null && this.#seed.min !== null && d.belowBound(this.#seed.min);
  }

  defaultAboveMax(): boolean {
    const d = this.#seed.def;
    return d !== null && this.#seed.max !== null && d.aboveBound(this.#seed.max);
  }

  // FD-E3: 文字列既定値が allowed_values の外。
  defaultOutsideAllowed(): boolean {
    const d = this.#seed.def;
    if (this.#seed.allowed === null || d === null || !d.isString()) return false;
    return !this.#seed.allowed.containsValue(d.asString());
  }

  // ライフサイクル属性の候補性（status/state の名を帯び allowed を持つ）。
  bearsLifecycleName(): boolean {
    return this.#seed.name.isLifecycleName();
  }

  // FD-S1: 図の状態のうち allowed values に無いもの（差分はコレクションが計算）。
  rogueDiagramStates(states: StateNames): string[] {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.rogueAmong(states);
  }

  // FD-S2: allowed values のうちどの図状態にも現れないもの。
  allowedValuesAbsentFrom(states: StateNames): string[] {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.absentFrom(states);
  }
}
