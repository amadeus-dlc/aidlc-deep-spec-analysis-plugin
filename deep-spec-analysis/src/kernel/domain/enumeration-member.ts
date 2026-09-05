import type { ParseError } from "@deep-spec/kernel-infrastructure";
import {
  compareCanonically,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

// 列挙宣言のメンバー。所属する列挙内ではリテラルで同定する。
export class EnumerationMember {
  readonly #value: string;

  /** リテラルの処理予算は4,096 UTF-16コード単位。空リテラルは契約上有効。 */
  private constructor(value: string) {
    if (value.length > 4096) throw new IllegalArgumentException({ kind: "enum-member-too-long", raw: value.length });
    this.#value = value;
  }

  static of(value: string): EnumerationMember {
    return new EnumerationMember(value);
  }
  static parse(value: string): Result<EnumerationMember, ParseError> {
    return parseConstruction(() => new EnumerationMember(value));
  }
  matchesLiteral(value: string): boolean {
    return this.#value === value;
  }
  equals(other: EnumerationMember): boolean {
    return this.#value === other.#value;
  }
  compareTo(other: EnumerationMember): number {
    return compareCanonically(this.#value, other.#value);
  }
  asString(): string {
    return this.#value;
  }
}
