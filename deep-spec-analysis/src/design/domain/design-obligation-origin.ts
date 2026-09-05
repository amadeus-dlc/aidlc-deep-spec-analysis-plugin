// 義務の起源（"" は未宣言・"rules" は BR 由来——decl 側の要求検査が使う語彙と
// 同じ閉集合。未知値は素通し）。
export class DesignObligationOrigin {
  readonly #value: string;

  private constructor(value: Parameters<typeof DesignObligationOrigin.of>[0]) {
    this.#value = value;
  }

  static of(raw: string): DesignObligationOrigin {
    return new DesignObligationOrigin(raw);
  }

  equals(other: DesignObligationOrigin): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isRules(): boolean {
    return this.#value === "rules";
  }
}
