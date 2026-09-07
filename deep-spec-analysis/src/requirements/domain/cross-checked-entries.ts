import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
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

  override map(transform: (element: CrossCheckedEntry) => CrossCheckedEntry): CrossCheckedEntries {
    return this.mapTo(transform, CrossCheckedEntries.of);
  }

  override combine(other: CrossCheckedEntries): CrossCheckedEntries {
    return this.combineTo(other, CrossCheckedEntries.of);
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

  // 境界: 描画専用。契約2 の crossChecked キー順（backend, targets）は
  // 旧構築サイトの挿入順そのもの（golden バイト凍結）。
  toDocuments(): Json[] {
    return this.#values.map(
      (entry) => ({ backend: entry.backend().asString(), targets: entry.targets().toStrings() }) as unknown as Json,
    );
  }

  toArray(): readonly CrossCheckedEntry[] {
    return this.#values;
  }
}
