// SmtQueryVerdicts — クエリ id（QueryLabel）→ SMT 判定の索引。内側は
// KeyedIndex（裁定 3-1、2026-09-03）。

import { KeyedIndex, type QueryLabel } from "@deep-spec/kernel-domain";
import { SmtQueryVerdict } from "./smt-query-verdict.ts";

export class SmtQueryVerdicts {
  readonly #values: KeyedIndex<QueryLabel, SmtQueryVerdict>;

  private constructor(values: KeyedIndex<QueryLabel, SmtQueryVerdict>) {
    this.#values = values;
  }

  static of(values: KeyedIndex<QueryLabel, SmtQueryVerdict>): SmtQueryVerdicts {
    return new SmtQueryVerdicts(values);
  }

  verdictOf(queryId: QueryLabel): SmtQueryVerdict {
    return this.#values.get(queryId) ?? SmtQueryVerdict.missing();
  }
}
