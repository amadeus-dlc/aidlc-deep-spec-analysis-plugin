import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import { NormalizedName } from "@deep-spec/kernel-domain";

export class StateName {
  readonly #value: string;
  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "state-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): StateName {
    return new StateName(raw);
  }

  static parse(raw: string): Result<StateName, ParseError> {
    return parseConstruction(() => new StateName(raw));
  }
  equals(other: StateName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
}
