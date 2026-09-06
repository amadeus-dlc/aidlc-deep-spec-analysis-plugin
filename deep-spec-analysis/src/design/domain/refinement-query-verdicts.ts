import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
// RefinementQueryVerdicts — クエリ id（QueryLabel）→ refinement 判定の索引。
// 内側は KeyedIndex（裁定 3-1、2026-09-03）。

import { KeyedIndex, type QueryLabel } from "@deep-spec-analysis/kernel-domain";
import type { RefinementQueryVerdict } from "./refinement-query-verdict.ts";
import type { RefinementQueryVerdictEntry } from "./refinement-query-verdict-entry.ts";

export class RefinementQueryVerdicts extends FirstClassCollectionBase<
  RefinementQueryVerdictEntry,
  RefinementQueryVerdicts
> {
  readonly #values: KeyedIndex<QueryLabel, RefinementQueryVerdictEntry>;

  private constructor(values: readonly RefinementQueryVerdictEntry[]) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 65_536, "too-many-refinement-query-verdicts");
    this.#values = KeyedIndex.of(snapshot.map((entry) => [entry.query(), entry] as const));
  }

  static of(values: readonly RefinementQueryVerdictEntry[]): RefinementQueryVerdicts {
    return new RefinementQueryVerdicts(values);
  }

  static parse(values: readonly RefinementQueryVerdictEntry[]): Result<RefinementQueryVerdicts, ParseError> {
    return parseConstruction(() => new RefinementQueryVerdicts(values));
  }

  protected rebuild(values: readonly RefinementQueryVerdictEntry[]): RefinementQueryVerdicts {
    return new RefinementQueryVerdicts(values);
  }

  *[Symbol.iterator](): Iterator<RefinementQueryVerdictEntry> {
    yield* this.#values.values();
  }

  verdictOf(queryId: QueryLabel): RefinementQueryVerdict | undefined {
    return this.#values.get(queryId)?.verdict();
  }
}
