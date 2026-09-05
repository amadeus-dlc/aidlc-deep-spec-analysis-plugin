import type { DesignIgnore } from "./design-ignore.ts";

// ignores 宣言のファーストクラスコレクション。lowering の (state, trigger)
// 文字列順という凍結順を所有する。
export class DesignIgnores {
  readonly #values: readonly DesignIgnore[];

  private constructor(values: readonly DesignIgnore[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignIgnore[]): DesignIgnores {
    return new DesignIgnores(values);
  }

  add(value: DesignIgnore): DesignIgnores {
    return new DesignIgnores([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnore> {
    yield* this.#values;
  }

  // 旧 lowering の逐語比較器（byte-frozen）。`/` 連結キーだが契約3 の
  // identifier パターン ^[a-z][a-zA-Z0-9_]*$ により state/trigger に `/` は
  // 入り得ず衝突しない。等値時に 1 を返す挙動も凍結面（field-wise + 0 への
  // 正規化は重複 (state,trigger)——well-formedness が collision として報告——の
  // 安定順を変え得るため PR10 の凍結台帳で扱う）。
  sortedByStateTrigger(): DesignIgnores {
    return new DesignIgnores([...this.#values].sort((a, b) => (`${a.state()}/${a.trigger().asString()}` < `${b.state()}/${b.trigger().asString()}` ? -1 : 1)));
  }

  toArray(): readonly DesignIgnore[] {
    return this.#values;
  }
}
