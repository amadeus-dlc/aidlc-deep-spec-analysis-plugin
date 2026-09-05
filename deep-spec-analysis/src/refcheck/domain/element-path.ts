import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// YAML/見出し内の位置指定子（witness の location に載る）。
export class ElementPath {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): ElementPath {
    return new ElementPath(raw);
  }

  static parse(raw: string): Result<ElementPath, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ElementPath(raw));
  }
  equals(other: ElementPath): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
