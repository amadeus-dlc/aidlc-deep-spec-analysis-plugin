// bindings は宣言順を保つ組の列（Object.entries の順序がエラー順序に出る）。
// 値は契約1 が許す JSON 値そのもので、型不一致の報告に JSON.stringify で
// 現れるため素の値のまま運ぶ。
export class IrBindingPairs {
  readonly #values: readonly (readonly [string, unknown])[];

  private constructor(values: readonly (readonly [string, unknown])[]) {
    this.#values = values;
  }

  static of(values: readonly (readonly [string, unknown])[]): IrBindingPairs {
    return new IrBindingPairs([...values]);
  }

  add(value: readonly [string, unknown]): IrBindingPairs {
    return new IrBindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, unknown]> {
    yield* this.#values;
  }

  toArray(): readonly (readonly [string, unknown])[] {
    return this.#values;
  }
}
