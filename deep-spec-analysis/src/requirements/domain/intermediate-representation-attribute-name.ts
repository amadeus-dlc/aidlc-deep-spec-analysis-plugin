import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfString,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

export class IntermediateRepresentationAttributeName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "ir-attribute-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }

  static of(raw: string): IntermediateRepresentationAttributeName {
    return new IntermediateRepresentationAttributeName(raw);
  }

  static parse(raw: string): Result<IntermediateRepresentationAttributeName, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationAttributeName(raw));
  }

  equals(other: IntermediateRepresentationAttributeName): boolean {
    return this.#value === other.#value;
  }

  hashCode(): number {
    return hashOfString(this.#value);
  }

  asString(): string {
    return this.#value;
  }
}
