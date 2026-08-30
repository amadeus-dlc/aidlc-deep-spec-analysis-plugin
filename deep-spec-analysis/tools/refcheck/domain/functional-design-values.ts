// functional-design（entities.md / rules.md / functional-spec.md / components.md）
// の語彙ドメインプリミティブ。すべて parse（strict な境界構築口・材料のみの
// エラー）と reconstitute（凍結文書からの逐語再水和——refcheck の取り込みは
// 全経路これ。壊れた値は parse で拒否せず、検査が**報告**する）を持つ。
// 照合・描画の解釈（正規化・整形）は語彙自身が所有し、検査は意味論だけを書く。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { normalizeName } from "../../kernel/domain/index.ts";

export type TokenError = { readonly kind: "empty-token"; readonly raw: string };
export type BoundError = { readonly kind: "not-finite"; readonly raw: number };

export class EntityName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<EntityName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new EntityName(raw));
  }
  static reconstitute(raw: string): EntityName { return new EntityName(raw); }
  equals(other: EntityName): boolean { return this.#value === other.#value; }
  // 境界: 文言・witness 位置に逐語で載る宣言名。
  value(): string { return this.#value; }
  // 照合はケース・区切りを畳んだ正規化名で行う（XS/FD-S の凍結挙動）。
  normalized(): string { return normalizeName(this.#value); }
}

export class AttributeName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AttributeName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AttributeName(raw));
  }
  static reconstitute(raw: string): AttributeName { return new AttributeName(raw); }
  equals(other: AttributeName): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  normalized(): string { return normalizeName(this.#value); }
}

// YAML/見出し内の位置指定子（witness の location に載る）。
export class ElementPath {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ElementPath, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ElementPath(raw));
  }
  static reconstitute(raw: string): ElementPath { return new ElementPath(raw); }
  equals(other: ElementPath): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
}

export class TypeName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<TypeName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new TypeName(raw));
  }
  static reconstitute(raw: string): TypeName { return new TypeName(raw); }
  equals(other: TypeName): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  // 型クラス（numeric/date/bool/…）の照合は小文字正規化で行う（凍結挙動）。
  normalized(): string { return this.#value.toLowerCase(); }
}

export class AllowedValue {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AllowedValue, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AllowedValue(raw));
  }
  static reconstitute(raw: string): AllowedValue { return new AllowedValue(raw); }
  equals(other: AllowedValue): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  normalized(): string { return normalizeName(this.#value); }
}

// default 宣言 — 文書上は文字列または数値（それ以外は宣言なし扱い＝凍結挙動）。
export class AttributeDefault {
  readonly #value: string | number;
  private constructor(value: string | number) { this.#value = value; }
  static reconstitute(raw: string | number): AttributeDefault { return new AttributeDefault(raw); }
  isNumber(): boolean { return typeof this.#value === "number"; }
  isString(): boolean { return typeof this.#value === "string"; }
  // 境界: 数値既定値の比較材料（isNumber ガード下でのみ意味を持つ）。
  asNumber(): number { return this.#value as number; }
  asString(): string { return String(this.#value); }
  // 境界: 凍結文言への埋め込み形（旧 `${def}` / String(def) と同一）。
  render(): string { return String(this.#value); }
}

export class NumericBound {
  readonly #value: number;
  private constructor(value: number) { this.#value = value; }
  static parse(raw: number): Result<NumericBound, BoundError> {
    if (!Number.isFinite(raw)) return err({ kind: "not-finite", raw });
    return ok(new NumericBound(raw));
  }
  static reconstitute(raw: number): NumericBound { return new NumericBound(raw); }
  equals(other: NumericBound): boolean { return this.#value === other.#value; }
  value(): number { return this.#value; }
}

export class CardinalityNotation {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<CardinalityNotation, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new CardinalityNotation(raw));
  }
  static reconstitute(raw: string): CardinalityNotation { return new CardinalityNotation(raw); }
  equals(other: CardinalityNotation): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  // 閉集合（1:1 | 1:N | N:1 | N:M）との照合形：大文字化・空白除去（凍結挙動）。
  normalizedToken(): string { return this.#value.toUpperCase().replace(/\s/g, ""); }
}

export class BusinessRuleId {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<BusinessRuleId, TokenError> {
    if (!/^BR[0-9]+\.[0-9]+$/.test(raw)) return err({ kind: "empty-token", raw });
    return ok(new BusinessRuleId(raw));
  }
  static reconstitute(raw: string): BusinessRuleId { return new BusinessRuleId(raw); }
  equals(other: BusinessRuleId): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  // BR{group}.{seq} 形か（FD-R2 の判定と finding target の選別に使う）。
  matchesShape(): boolean { return /^BR[0-9]+\.[0-9]+$/.test(this.#value); }
}

export class RuleCategory {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<RuleCategory, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new RuleCategory(raw));
  }
  static reconstitute(raw: string): RuleCategory { return new RuleCategory(raw); }
  equals(other: RuleCategory): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  normalized(): string { return this.#value.toLowerCase(); }
}

export class AppliesTo {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AppliesTo, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AppliesTo(raw));
  }
  static reconstitute(raw: string): AppliesTo { return new AppliesTo(raw); }
  equals(other: AppliesTo): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
}

// rules.md の source 欄から抽出された FR/NFR 参照。
export class SourceId {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<SourceId, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new SourceId(raw));
  }
  static reconstitute(raw: string): SourceId { return new SourceId(raw); }
  equals(other: SourceId): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
}

// `### State Machine: <spec>` 見出しの対象（"Entity" または "Entity.attribute"）。
export class MachineSpec {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<MachineSpec, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new MachineSpec(raw));
  }
  static reconstitute(raw: string): MachineSpec { return new MachineSpec(raw); }
  equals(other: MachineSpec): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  // "Entity.attribute" の分解は spec 語彙そのもの（旧 split(".") の凍結挙動）。
  entityToken(): string { return this.#value.split(".")[0] ?? ""; }
  attributeToken(): string | undefined { return this.#value.split(".")[1]; }
}

export class StateName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<StateName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new StateName(raw));
  }
  static reconstitute(raw: string): StateName { return new StateName(raw); }
  equals(other: StateName): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
  normalized(): string { return normalizeName(this.#value); }
}

export class ComponentName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ComponentName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ComponentName(raw));
  }
  static reconstitute(raw: string): ComponentName { return new ComponentName(raw); }
  equals(other: ComponentName): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
}

// FD-E6 の参照先トークン（"Entity" / "Entity.attribute" / 自由文）。
export class ReferenceTarget {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ReferenceTarget, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ReferenceTarget(raw));
  }
  static reconstitute(raw: string): ReferenceTarget { return new ReferenceTarget(raw); }
  equals(other: ReferenceTarget): boolean { return this.#value === other.#value; }
  value(): string { return this.#value; }
}
