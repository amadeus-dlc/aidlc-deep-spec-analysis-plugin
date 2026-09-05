import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// decl 束のエンティティ名（well-formedness の重複・座標文言が使う）。
export class IntermediateRepresentationEntityName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "ir-entity-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }

  static of(raw: string): IntermediateRepresentationEntityName {
    return new IntermediateRepresentationEntityName(raw);
  }

  static parse(raw: string): Result<IntermediateRepresentationEntityName, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationEntityName(raw));
  }

  equals(other: IntermediateRepresentationEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
