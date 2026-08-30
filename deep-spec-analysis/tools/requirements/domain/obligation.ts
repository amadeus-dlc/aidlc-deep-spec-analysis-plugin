// 義務（EARS nature 付き）。逐語移動。

import type { Expression } from "../../kernel/domain/expression.ts";

export interface Obligation {
  id: string;
  nature: string;
  frRefs: string[];
  ears?: string;
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}

// 義務のファーストクラスコレクション。id 検索と id 列の導出を所有する。
export class Obligations {
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    this.#values = values;
  }

  static of(values: readonly Obligation[]): Obligations {
    return new Obligations([...values]);
  }

  add(value: Obligation): Obligations {
    return new Obligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Obligation> {
    yield* this.#values;
  }

  byId(id: string): Obligation | undefined {
    return this.#values.find((o) => o.id === id);
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id);
  }

  toArray(): readonly Obligation[] {
    return this.#values;
  }
}
