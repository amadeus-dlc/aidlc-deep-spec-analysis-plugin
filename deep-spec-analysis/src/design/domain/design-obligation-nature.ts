import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
export class DesignObligationNature {
  readonly #value: string;

  /** 128 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "design-obligation-nature-too-long", raw: value.length });

    this.#value = value;
  }

  static parse(value: string): Result<DesignObligationNature, ParseError> {
    return parseConstruction(() => new DesignObligationNature(value));
  }

  static of(raw: string): DesignObligationNature {
    return new DesignObligationNature(raw);
  }

  equals(other: DesignObligationNature): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isEvent(): boolean {
    return this.#value === "event";
  }

  isInvariant(): boolean {
    return this.#value === "invariant";
  }

  isNumeric(): boolean {
    return this.#value === "numeric";
  }

  isStateTemporal(): boolean {
    return this.#value === "state-temporal";
  }
}
