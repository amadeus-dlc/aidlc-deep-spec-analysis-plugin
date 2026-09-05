import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignAttributeName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-attribute-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignAttributeName {
    return new DesignAttributeName(raw);
  }

  static parse(raw: string): Result<DesignAttributeName, ParseError> {
    return parseConstruction(() => new DesignAttributeName(raw));
  }

  equals(other: DesignAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
