import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

// YAML/見出し内の位置指定子（witness の location に載る）。
export class ElementPath {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ElementPath, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ElementPath(raw));
  }
  static reconstitute(raw: string): ElementPath { return new ElementPath(raw); }
  equals(other: ElementPath): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
