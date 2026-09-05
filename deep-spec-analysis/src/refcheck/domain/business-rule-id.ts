import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class BusinessRuleId {
  readonly #value: string;
  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "business-rule-id-too-long", raw: raw.length });
    if (!/^BR[0-9]+\.[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): BusinessRuleId {
    return new BusinessRuleId(raw);
  }

  static parse(raw: string): Result<BusinessRuleId, ParseError> {
    return parseConstruction(() => new BusinessRuleId(raw));
  }
  equals(other: BusinessRuleId): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // BR{group}.{seq} 形か（FD-R2 の判定と finding target の選別に使う）。
  matchesShape(): boolean { return /^BR[0-9]+\.[0-9]+$/.test(this.#value); }
}
