import { NormalizedName } from "@deep-spec/kernel-domain";
import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class AttributeName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AttributeName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AttributeName(raw));
  }
  static reconstitute(raw: string): AttributeName { return new AttributeName(raw); }
  equals(other: AttributeName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
  // ライフサイクル属性名の語彙（status/state——FD-S1 候補性の凍結集合）。
  isLifecycleName(): boolean { return this.#value === "status" || this.#value === "state"; }
  // identifier 欄の空宣言（DD-5 の structure-invalid 判定）。
  isEmpty(): boolean { return this.#value === ""; }
}
