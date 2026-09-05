import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

// eventMap.transitions の要素——写像先の設計 遷移/義務 id への宣言参照。
export class TransitionRef {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }

  static of(raw: string): TransitionRef {
    return new TransitionRef(raw);
  }

  static parse(raw: string): Result<TransitionRef, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new TransitionRef(raw));
  }

  equals(other: TransitionRef): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）——kernel の TargetId が所有する順序に従う（裁定 1）。
  compareTo(other: TransitionRef): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
