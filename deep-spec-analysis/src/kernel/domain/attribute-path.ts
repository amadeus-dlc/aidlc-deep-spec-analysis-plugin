import type { ParseError } from "@deep-spec/kernel-infrastructure";
import {
  compareCanonically,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

// "Entity.attribute" 形の要件属性パス。
export class AttributePath {
  readonly #value: string;

  /** 128文字の実体名と属性名、および区切り1文字の上限。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 257) throw new IllegalArgumentException({ kind: "attribute-path-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-attribute-path", raw });
    this.#value = raw;
  }

  static of(raw: string): AttributePath {
    return new AttributePath(raw);
  }

  static parse(raw: string): Result<AttributePath, ParseError> {
    return parseConstruction(() => new AttributePath(raw));
  }

  equals(other: AttributePath): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: AttributePath): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
