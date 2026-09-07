import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";

// クロスチェック判定表のファーストクラスコレクション。
export class DesignCrossCheckedEntries extends FirstClassCollectionBase<
  DesignCrossCheckedEntry,
  DesignCrossCheckedEntries
> {
  readonly #values: readonly DesignCrossCheckedEntry[];

  private constructor(values: readonly DesignCrossCheckedEntry[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-cross-checked-entries");
  }

  protected override rebuild(values: readonly DesignCrossCheckedEntry[]): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries(values);
  }

  static of(values: readonly DesignCrossCheckedEntry[]): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries(values);
  }

  override map(transform: (element: DesignCrossCheckedEntry) => DesignCrossCheckedEntry): DesignCrossCheckedEntries {
    return this.mapTo(transform, DesignCrossCheckedEntries.of);
  }

  override combine(other: DesignCrossCheckedEntries): DesignCrossCheckedEntries {
    return this.combineTo(other, DesignCrossCheckedEntries.of);
  }

  static parse(values: readonly DesignCrossCheckedEntry[]): Result<DesignCrossCheckedEntries, ParseError> {
    return parseConstruction(() => new DesignCrossCheckedEntries(values));
  }

  add(value: DesignCrossCheckedEntry): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignCrossCheckedEntry> {
    yield* this.#values;
  }

  // 境界: 描画専用。契約2 の crossChecked キー順（backend, unit, targets）。
  toDocuments(): Json[] {
    return this.#values.map((entry) => ({
      backend: entry.backend().asString(),
      unit: entry.unit().asString(),
      targets: [...entry.targets().toStrings()],
    }));
  }

  toArray(): readonly DesignCrossCheckedEntry[] {
    return this.#values;
  }
}
