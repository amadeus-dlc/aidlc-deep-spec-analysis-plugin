import type { AttributePath } from "@deep-spec/requirements-domain";
import type { RefinementAttribute } from "./refinement-attribute.ts";

// 要件属性のファーストクラスコレクション。path 索引は旧 new Map(...) の
// 凍結挙動どおり重複 path は最後の宣言が勝つ。
export class RefinementAttributes {
  readonly #values: readonly RefinementAttribute[];

  private constructor(values: readonly RefinementAttribute[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly RefinementAttribute[]): RefinementAttributes {
    return new RefinementAttributes(values);
  }

  add(value: RefinementAttribute): RefinementAttributes {
    return new RefinementAttributes([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementAttribute> {
    yield* this.#values;
  }

  // 索引は Expression（published language）の生パスも DP も受ける——照合は
  // コレクション自身の知識（Tell-Don't-Ask 裁定）。
  byPath(path: AttributePath | string): RefinementAttribute | undefined {
    const key = typeof path === "string" ? path : path.asString();
    let found: RefinementAttribute | undefined;
    for (const a of this.#values) {
      if (a.isAt(key)) found = a;
    }
    return found;
  }

  covers(path: AttributePath | string): boolean {
    const key = typeof path === "string" ? path : path.asString();
    return this.#values.some((a) => a.isAt(key));
  }

  // 閉包検査・フレーム構築の走査順（path の辞書順）はコレクション知識。
  sortedByPath(): RefinementAttributes {
    return new RefinementAttributes(
      [...this.#values].sort((x, y) => (x.path().asString() < y.path().asString() ? -1 : 1)),
    );
  }

  toArray(): readonly RefinementAttribute[] {
    return this.#values;
  }
}
