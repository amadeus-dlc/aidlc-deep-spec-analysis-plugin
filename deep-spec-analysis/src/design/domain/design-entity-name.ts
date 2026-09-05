import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignEntityName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-entity-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignEntityName {
    return new DesignEntityName(raw);
  }

  static parse(raw: string): Result<DesignEntityName, ParseError> {
    return parseConstruction(() => new DesignEntityName(raw));
  }

  equals(other: DesignEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
