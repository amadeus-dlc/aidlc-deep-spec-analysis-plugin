import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// YAML/見出し内の位置指定子（witness の location に載る）。
export class ElementPath {
  readonly #value: string;
  /** 入れ子の文書位置を記述するパスの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "element-path-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): ElementPath {
    return new ElementPath(raw);
  }

  static parse(raw: string): Result<ElementPath, ParseError> {
    return parseConstruction(() => new ElementPath(raw));
  }
  equals(other: ElementPath): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
