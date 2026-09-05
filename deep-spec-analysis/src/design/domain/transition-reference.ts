import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

// eventMap.transitions の要素——写像先の設計 遷移/義務 id への宣言参照。
export class TransitionReference {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "transition-ref-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }

  static of(raw: string): TransitionReference {
    return new TransitionReference(raw);
  }

  static parse(raw: string): Result<TransitionReference, ParseError> {
    return parseConstruction(() => new TransitionReference(raw));
  }

  equals(other: TransitionReference): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetIdentifier が所有する順序に従う（裁定 1）。
  compareTo(other: TransitionReference): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
