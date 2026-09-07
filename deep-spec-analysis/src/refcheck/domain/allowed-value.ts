import { NormalizedName } from "@deep-spec-analysis/kernel-domain";
import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfString,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

export class AllowedValue {
  readonly #value: string;
  /** 列挙リテラルの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "allowed-value-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): AllowedValue {
    return new AllowedValue(raw);
  }

  static parse(raw: string): Result<AllowedValue, ParseError> {
    return parseConstruction(() => new AllowedValue(raw));
  }
  equals(other: AllowedValue): boolean {
    return this.#value === other.#value;
  }
  hashCode(): number {
    return hashOfString(this.#value);
  }
  asString(): string {
    return this.#value;
  }
  normalized(): NormalizedName {
    return NormalizedName.of(this.#value);
  }
}
