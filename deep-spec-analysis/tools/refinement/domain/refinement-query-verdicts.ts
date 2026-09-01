import type { RefinementQueryVerdict } from "./refinement-query-verdict.ts";

// クエリ id → 判定のファーストクラスな判定面。
export class RefinementQueryVerdicts {
  readonly #values: ReadonlyMap<string, RefinementQueryVerdict>;

  private constructor(values: ReadonlyMap<string, RefinementQueryVerdict>) {
    this.#values = values;
  }

  static of(values: ReadonlyMap<string, RefinementQueryVerdict>): RefinementQueryVerdicts {
    return new RefinementQueryVerdicts(new Map(values));
  }

  verdictOf(queryId: string): RefinementQueryVerdict | undefined {
    return this.#values.get(queryId);
  }
}
