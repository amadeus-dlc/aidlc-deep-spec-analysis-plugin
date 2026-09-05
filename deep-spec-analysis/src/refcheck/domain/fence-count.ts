import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
// FenceCount — 文書に見つかった yaml fence の個数のドメインプリミティブ
//（種別規律の裁定 3-4、2026-09-03）。「ちょうど 1 個」でないときの凍結文言
// `(found N)` の材料。

export class FenceCount {
  readonly #value: number;

  private constructor(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new IllegalArgumentException({ kind: "invalid-fence-count", raw: value });
    this.#value = value;
  }

  static of(value: number): FenceCount {
    return new FenceCount(value);
  }

  asNumber(): number {
    return this.#value;
  }
}
