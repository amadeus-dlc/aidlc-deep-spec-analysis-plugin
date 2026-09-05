import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class BackgroundAssumptionId {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "background-assumption-id-too-long", raw: raw.length });
    if (!/^BG-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-background-assumption-id", raw });
    this.#value = raw;
  }

  static of(raw: string): BackgroundAssumptionId {
    return new BackgroundAssumptionId(raw);
  }

  static parse(raw: string): Result<BackgroundAssumptionId, ParseError> {
    return parseConstruction(() => new BackgroundAssumptionId(raw));
  }

  equals(other: BackgroundAssumptionId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
