import type { FirstClassCollection } from "@deep-spec-analysis/kernel-domain";
// SatisfiabilityModuloTheoriesQueryVerdicts — クエリ id（QueryLabel）→ SMT 判定の索引。内側は
// KeyedIndex（裁定 3-1、2026-09-03）。

import type { KeyedIndex, QueryLabel } from "@deep-spec-analysis/kernel-domain";
import { SatisfiabilityModuloTheoriesQueryVerdict } from "./satisfiability-modulo-theories-query-verdict.ts";

export class SatisfiabilityModuloTheoriesQueryVerdicts implements FirstClassCollection {
  readonly #values: KeyedIndex<QueryLabel, SatisfiabilityModuloTheoriesQueryVerdict>;

  private constructor(values: KeyedIndex<QueryLabel, SatisfiabilityModuloTheoriesQueryVerdict>) {
    this.#values = values;
  }

  static of(
    values: KeyedIndex<QueryLabel, SatisfiabilityModuloTheoriesQueryVerdict>,
  ): SatisfiabilityModuloTheoriesQueryVerdicts {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }

  verdictOf(queryId: QueryLabel): SatisfiabilityModuloTheoriesQueryVerdict {
    return this.#values.get(queryId) ?? SatisfiabilityModuloTheoriesQueryVerdict.missing();
  }

  isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
