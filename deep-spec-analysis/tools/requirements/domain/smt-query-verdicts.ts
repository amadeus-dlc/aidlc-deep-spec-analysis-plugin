import type { SmtQueryVerdict } from "./smt-query-verdict.ts";


// クエリ id → 判定のファーストクラスな判定面。
export class SmtQueryVerdicts {
  readonly #values: ReadonlyMap<string, SmtQueryVerdict>;

  private constructor(values: ReadonlyMap<string, SmtQueryVerdict>) {
    this.#values = values;
  }

  static of(values: ReadonlyMap<string, SmtQueryVerdict>): SmtQueryVerdicts {
    return new SmtQueryVerdicts(new Map(values));
  }

  verdictOf(queryId: string): SmtQueryVerdict | undefined {
    return this.#values.get(queryId);
  }
}
