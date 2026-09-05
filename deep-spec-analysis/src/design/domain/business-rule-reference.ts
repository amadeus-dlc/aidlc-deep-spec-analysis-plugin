import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";
// BusinessRuleReference — 設計要素が指す業務規則 id（BR1.2 …）のドメインプリミティブ
//（種別規律の裁定 3-1、2026-09-03）。並びは rules.md 側の凍結挙動どおり
// 単純な文字列順。

export class BusinessRuleReference {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 128) throw new IllegalArgumentException({ kind: "br-ref-too-long", raw: value.length });
    if (!/^BR[0-9]+\.[0-9]+$/.test(value)) throw new IllegalArgumentException({ kind: "malformed-business-rule-reference", raw: value });
    this.#value = value;
  }

  static of(raw: string): BusinessRuleReference {
    return new BusinessRuleReference(raw);
  }

  static parse(raw: string): Result<BusinessRuleReference, ParseError> {
    return parseConstruction(() => new BusinessRuleReference(raw));
  }

  equals(other: BusinessRuleReference): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: BusinessRuleReference): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }

  asString(): string {
    return this.#value;
  }
}
