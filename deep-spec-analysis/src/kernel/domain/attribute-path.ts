import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

// "Entity.attribute" 形の要件属性パス。
export class AttributePath {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-attribute-path", raw });
    this.#value = raw;
  }

  static of(raw: string): AttributePath {
    return new AttributePath(raw);
  }

  static parse(raw: string): Result<AttributePath, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new AttributePath(raw));
  }

  equals(other: AttributePath): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: AttributePath): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
