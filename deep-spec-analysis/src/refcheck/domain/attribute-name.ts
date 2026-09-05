import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import { NormalizedName } from "@deep-spec/kernel-domain";

export class AttributeName {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): AttributeName {
    return new AttributeName(raw);
  }

  static parse(raw: string): Result<AttributeName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new AttributeName(raw));
  }
  equals(other: AttributeName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
  // ライフサイクル属性名の語彙（status/state——FD-S1 候補性の凍結集合）。
  isLifecycleName(): boolean { return this.#value === "status" || this.#value === "state"; }
  // identifier 欄の空宣言（DD-5 の structure-invalid 判定）。
  isEmpty(): boolean { return this.#value === ""; }
}
