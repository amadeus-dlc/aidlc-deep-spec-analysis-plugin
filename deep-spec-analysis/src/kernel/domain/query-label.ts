import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";
// QueryLabel — ソルバへ発行するクエリの id と、unsat core の表明ラベルの
// ドメインプリミティブ（種別規律の裁定 3-1／3-3、2026-09-03）。並びは文書の
// 凍結挙動どおり単純な文字列順。

export class QueryLabel {
  readonly #value: string;

  /** 複数の対象IDから組み立てるソルバラベルの上限。 単位はUTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 2048) throw new IllegalArgumentException({ kind: "query-label-too-long", raw: value.length });
    if (value === "") throw new IllegalArgumentException({ kind: "empty-query-label", raw: value });
    this.#value = value;
  }

  static of(raw: string): QueryLabel {
    return new QueryLabel(raw);
  }

  static parse(raw: string): Result<QueryLabel, ParseError> {
    return parseConstruction(() => new QueryLabel(raw));
  }

  equals(other: QueryLabel): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: QueryLabel): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }

  asString(): string {
    return this.#value;
  }
}
