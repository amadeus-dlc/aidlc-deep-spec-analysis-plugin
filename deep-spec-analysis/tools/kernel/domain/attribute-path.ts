import { TargetId } from "./target-id.ts";
import { err, ok } from "../infrastructure/index.ts";
import type { Result } from "../infrastructure/index.ts";

type AttributePathError = { readonly kind: "empty-attribute-path"; readonly raw: string };

// "Entity.attribute" 形の要件属性パス。
export class AttributePath {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<AttributePath, AttributePathError> {
    if (raw === "") return err({ kind: "empty-attribute-path", raw });
    return ok(new AttributePath(raw));
  }

  static reconstitute(raw: string): AttributePath {
    return new AttributePath(raw);
  }

  equals(other: AttributePath): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: AttributePath): number {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }

  asString(): string {
    return this.#value;
  }
}
