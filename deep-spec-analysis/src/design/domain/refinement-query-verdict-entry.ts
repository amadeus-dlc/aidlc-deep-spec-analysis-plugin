import type { QueryLabel } from "@deep-spec-analysis/kernel-domain";
import { combinedHash } from "@deep-spec-analysis/kernel-infrastructure";
import type { RefinementQueryVerdict } from "./refinement-query-verdict.ts";

/** クエリラベルと判定を同時に保持する論理要素。値だけでは索引キーを復元できない。 */
export class RefinementQueryVerdictEntry {
  readonly #query: QueryLabel;
  readonly #verdict: RefinementQueryVerdict;

  private constructor(query: QueryLabel, verdict: RefinementQueryVerdict) {
    this.#query = query;
    this.#verdict = verdict;
  }

  static of(query: QueryLabel, verdict: RefinementQueryVerdict): RefinementQueryVerdictEntry {
    return new RefinementQueryVerdictEntry(query, verdict);
  }

  query(): QueryLabel {
    return this.#query;
  }

  verdict(): RefinementQueryVerdict {
    return this.#verdict;
  }

  equals(other: RefinementQueryVerdictEntry): boolean {
    return this.#query.equals(other.#query) && this.#verdict.equals(other.#verdict);
  }

  hashCode(): number {
    return combinedHash([this.#query.hashCode(), this.#verdict.hashCode()]);
  }
}
