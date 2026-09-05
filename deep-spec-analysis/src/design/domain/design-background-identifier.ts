import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignBackgroundIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-background-id-too-long", raw: raw.length });
    if (!/^DBG-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-background-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignBackgroundIdentifier {
    return new DesignBackgroundIdentifier(raw);
  }

  static parse(raw: string): Result<DesignBackgroundIdentifier, ParseError> {
    return parseConstruction(() => new DesignBackgroundIdentifier(raw));
  }

  equals(other: DesignBackgroundIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: DesignBackgroundIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
