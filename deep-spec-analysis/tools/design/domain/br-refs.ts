// BrRefs — 設計要素が指す業務規則 id の列（ファーストクラスコレクション）。
// 要素は BrRef（裁定 3-1、2026-09-03）。of は DP の門、reconstitute は parser の
// 生 id 材料から。

import { BrRef } from "./br-ref.ts";

export class BrRefs {
  readonly #values: readonly BrRef[];

  private constructor(values: readonly BrRef[]) {
    this.#values = values;
  }

  static of(values: readonly BrRef[]): BrRefs {
    return new BrRefs([...values]);
  }

  static reconstitute(raws: readonly string[]): BrRefs {
    return new BrRefs(raws.map((raw) => BrRef.reconstitute(raw)));
  }

  add(value: BrRef): BrRefs {
    return new BrRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<BrRef> {
    yield* this.#values;
  }

  toArray(): readonly BrRef[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
