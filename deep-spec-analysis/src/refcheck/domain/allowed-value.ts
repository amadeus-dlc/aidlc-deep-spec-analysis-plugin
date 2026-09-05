import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import { NormalizedName } from "@deep-spec/kernel-domain";

export class AllowedValue {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): AllowedValue {
    return new AllowedValue(raw);
  }

  static parse(raw: string): Result<AllowedValue, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new AllowedValue(raw));
  }
  equals(other: AllowedValue): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
}
