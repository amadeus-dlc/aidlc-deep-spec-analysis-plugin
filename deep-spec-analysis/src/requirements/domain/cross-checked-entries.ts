import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { CrossCheckedEntry } from "./cross-checked-entry.ts";

// クロスチェック判定表のファーストクラスコレクション。
export class CrossCheckedEntries
  extends FirstClassCollectionBase<CrossCheckedEntry, CrossCheckedEntries>
  implements FirstClassCollection<CrossCheckedEntry>
{
  readonly #values: readonly CrossCheckedEntry[];

  private constructor(values: readonly CrossCheckedEntry[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-cross-checked-entries");
  }

  protected override rebuild(values: readonly CrossCheckedEntry[]): CrossCheckedEntries {
    return new CrossCheckedEntries(values);
  }

  static parse(values: readonly CrossCheckedEntry[]): Result<CrossCheckedEntries, ParseError> {
    return parseConstruction(() => new CrossCheckedEntries(values));
  }

  static of(values: readonly CrossCheckedEntry[]): CrossCheckedEntries {
    return new CrossCheckedEntries(values);
  }

  add(value: CrossCheckedEntry): CrossCheckedEntries {
    return new CrossCheckedEntries([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<CrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly CrossCheckedEntry[] {
    return this.#values;
  }
}
