import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class DesignTransitionId {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "design-transition-id-too-long", raw: raw.length });
    if (!/^TR-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-design-transition-id", raw });
    this.#value = raw;
  }

  static of(raw: string): DesignTransitionId {
    return new DesignTransitionId(raw);
  }

  static parse(raw: string): Result<DesignTransitionId, ParseError> {
    return parseConstruction(() => new DesignTransitionId(raw));
  }

  equals(other: DesignTransitionId): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: DesignTransitionId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
