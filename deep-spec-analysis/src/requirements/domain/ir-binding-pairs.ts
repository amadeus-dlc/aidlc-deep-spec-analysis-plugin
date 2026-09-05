import type { Json } from "@deep-spec/kernel-infrastructure";

// bindings は宣言順を保つ組の列（Object.entries の順序がエラー順序に出る）。
// 値は契約1 が許す JSON 値そのもので、型不一致の報告に JSON.stringify で
// 現れるため素の値のまま運ぶ。
export class IrBindingPairs {
  readonly #values: readonly (readonly [string, Json])[];

  private constructor(values: readonly (readonly [string, Json])[]) {
    this.#values = structuredClone(values);
  }

  static of(values: readonly (readonly [string, Json])[]): IrBindingPairs {
    return new IrBindingPairs(values);
  }

  add(value: readonly [string, Json]): IrBindingPairs {
    return new IrBindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, Json]> {
    yield* this.toArray();
  }

  toArray(): readonly (readonly [string, Json])[] {
    return structuredClone(this.#values);
  }
}
