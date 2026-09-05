import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import { NormalizedName } from "@deep-spec/kernel-domain";

export class StateName {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): StateName {
    return new StateName(raw);
  }

  static parse(raw: string): Result<StateName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new StateName(raw));
  }
  equals(other: StateName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
}
