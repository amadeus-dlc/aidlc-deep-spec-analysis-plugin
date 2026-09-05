// BrRef — 設計要素が指す業務規則 id（BR1.2 …）のドメインプリミティブ
//（種別規律の裁定 3-1、2026-09-03）。並びは rules.md 側の凍結挙動どおり
// 単純な文字列順。

export class BrRef {
  readonly #value: string;

  private constructor(value: Parameters<typeof BrRef.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): BrRef {
    return new BrRef(raw);
  }

  equals(other: BrRef): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: BrRef): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }

  asString(): string {
    return this.#value;
  }
}
