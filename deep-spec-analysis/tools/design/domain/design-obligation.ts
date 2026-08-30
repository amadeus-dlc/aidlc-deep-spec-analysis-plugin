// 設計義務（rules 起源の BR 参照つき）。逐語移動。

import type { Expression, FrRefs } from "../../kernel/domain/index.ts";
import type { BrRefs } from "./design-ir-decl.ts";

export interface DesignObligation {
  id: string;
  nature: string;
  origin: string;
  brRefs: BrRefs;
  frRefs: FrRefs;
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}

// 設計義務のファーストクラスコレクション。id 列の導出を所有する。
export class DesignObligations {
  readonly #values: readonly DesignObligation[];

  private constructor(values: readonly DesignObligation[]) {
    this.#values = values;
  }

  static of(values: readonly DesignObligation[]): DesignObligations {
    return new DesignObligations([...values]);
  }

  add(value: DesignObligation): DesignObligations {
    return new DesignObligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignObligation> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id);
  }

  toArray(): readonly DesignObligation[] {
    return this.#values;
  }
}
