import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignObligationIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-obligation-id-too-long", raw: raw.length });
    if (!/^DOB-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-obligation-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignObligationIdentifier {
    return new DesignObligationIdentifier(raw);
  }

  static parse(raw: string): Result<DesignObligationIdentifier, ParseError> {
    return parseConstruction(() => new DesignObligationIdentifier(raw));
  }

  equals(other: DesignObligationIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: DesignObligationIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
