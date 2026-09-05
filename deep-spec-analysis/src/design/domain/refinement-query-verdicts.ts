// RefinementQueryVerdicts — クエリ id（QueryLabel）→ refinement 判定の索引。
// 内側は KeyedIndex（裁定 3-1、2026-09-03）。

import type { KeyedIndex, QueryLabel } from "@deep-spec/kernel-domain";
import type { RefinementQueryVerdict } from "./refinement-query-verdict.ts";

export class RefinementQueryVerdicts {
  readonly #values: KeyedIndex<QueryLabel, RefinementQueryVerdict>;

  private constructor(values: KeyedIndex<QueryLabel, RefinementQueryVerdict>) {
    this.#values = values;
  }

  static of(values: KeyedIndex<QueryLabel, RefinementQueryVerdict>): RefinementQueryVerdicts {
    return new RefinementQueryVerdicts(values);
  }

  verdictOf(queryId: QueryLabel): RefinementQueryVerdict | undefined {
    return this.#values.get(queryId);
  }
}
