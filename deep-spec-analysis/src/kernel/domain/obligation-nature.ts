import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfString,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
export class ObligationNature {
  readonly #value: string;

  /** 128 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "obligation-nature-too-long", raw: value.length });

    this.#value = value;
  }

  static parse(value: string): Result<ObligationNature, ParseError> {
    return parseConstruction(() => new ObligationNature(value));
  }

  static of(raw: string): ObligationNature {
    return new ObligationNature(raw);
  }

  equals(other: ObligationNature): boolean {
    return this.#value === other.#value;
  }

  hashCode(): number {
    return hashOfString(this.#value);
  }

  asString(): string {
    return this.#value;
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}
