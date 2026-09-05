// QueryLabel — ソルバへ発行するクエリの id と、unsat core の表明ラベルの
// ドメインプリミティブ（種別規律の裁定 3-1／3-3、2026-09-03）。並びは文書の
// 凍結挙動どおり単純な文字列順。

export class QueryLabel {
  readonly #value: string;

  private constructor(value: Parameters<typeof QueryLabel.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): QueryLabel {
    return new QueryLabel(raw);
  }

  equals(other: QueryLabel): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: QueryLabel): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }

  asString(): string {
    return this.#value;
  }
}
