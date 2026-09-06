import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeyedIndex,
  type QueryLabel,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";

// SatisfiabilityModuloTheoriesQueryVerdicts — クエリ id（QueryLabel）→ SMT 判定の索引。内側は
// KeyedIndex（裁定 3-1、2026-09-03）。

import { boundedCollectionSnapshot } from "@deep-spec-analysis/kernel-infrastructure";

import { SatisfiabilityModuloTheoriesQueryVerdict } from "./satisfiability-modulo-theories-query-verdict.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdictEntry } from "./satisfiability-modulo-theories-query-verdict-entry.ts";

export class SatisfiabilityModuloTheoriesQueryVerdicts
  extends FirstClassCollectionBase<
    SatisfiabilityModuloTheoriesQueryVerdictEntry,
    SatisfiabilityModuloTheoriesQueryVerdicts
  >
  implements FirstClassCollection<SatisfiabilityModuloTheoriesQueryVerdictEntry>
{
  readonly #values: KeyedIndex<QueryLabel, SatisfiabilityModuloTheoriesQueryVerdictEntry>;

  private constructor(values: readonly SatisfiabilityModuloTheoriesQueryVerdictEntry[]) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 65_536, "too-many-satisfiability-query-verdicts");
    this.#values = KeyedIndex.of(snapshot.map((entry) => [entry.query(), entry] as const));
  }

  protected rebuild(
    values: readonly SatisfiabilityModuloTheoriesQueryVerdictEntry[],
  ): SatisfiabilityModuloTheoriesQueryVerdicts {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }

  *[Symbol.iterator](): Iterator<SatisfiabilityModuloTheoriesQueryVerdictEntry> {
    yield* this.#values.values();
  }

  toArray(): readonly SatisfiabilityModuloTheoriesQueryVerdictEntry[] {
    return [...this];
  }

  static parse(
    values: readonly SatisfiabilityModuloTheoriesQueryVerdictEntry[],
  ): Result<SatisfiabilityModuloTheoriesQueryVerdicts, ParseError> {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesQueryVerdicts(values));
  }

  static of(
    values: readonly SatisfiabilityModuloTheoriesQueryVerdictEntry[],
  ): SatisfiabilityModuloTheoriesQueryVerdicts {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }

  verdictOf(queryId: QueryLabel): SatisfiabilityModuloTheoriesQueryVerdict {
    return this.#values.get(queryId)?.verdict() ?? SatisfiabilityModuloTheoriesQueryVerdict.missing();
  }
}
