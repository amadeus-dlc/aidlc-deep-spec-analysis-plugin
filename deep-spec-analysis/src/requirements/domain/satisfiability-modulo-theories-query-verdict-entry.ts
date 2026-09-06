import type { QueryLabel } from "@deep-spec-analysis/kernel-domain";
import type { SatisfiabilityModuloTheoriesQueryVerdict } from "./satisfiability-modulo-theories-query-verdict.ts";

// SMT クエリの索引項目。verdict だけでは QueryLabel との対応を復元できないため、
// 共通コレクションの論理要素としてキーと値を一緒に運ぶ。
export class SatisfiabilityModuloTheoriesQueryVerdictEntry {
  readonly #query: QueryLabel;
  readonly #verdict: SatisfiabilityModuloTheoriesQueryVerdict;

  private constructor(query: QueryLabel, verdict: SatisfiabilityModuloTheoriesQueryVerdict) {
    this.#query = query;
    this.#verdict = verdict;
  }

  static of(
    query: QueryLabel,
    verdict: SatisfiabilityModuloTheoriesQueryVerdict,
  ): SatisfiabilityModuloTheoriesQueryVerdictEntry {
    return new SatisfiabilityModuloTheoriesQueryVerdictEntry(query, verdict);
  }

  query(): QueryLabel {
    return this.#query;
  }

  verdict(): SatisfiabilityModuloTheoriesQueryVerdict {
    return this.#verdict;
  }

  equals(other: SatisfiabilityModuloTheoriesQueryVerdictEntry): boolean {
    return this.#query.equals(other.#query) && this.#verdict.equals(other.#verdict);
  }
}
