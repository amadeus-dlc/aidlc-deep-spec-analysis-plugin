import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
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

  static parse(values: readonly DesignCrossCheckedEntry[]): Result<DesignCrossCheckedEntries, ParseError> {
    return parseConstruction(() => new DesignCrossCheckedEntries(values));
  }

  add(value: DesignCrossCheckedEntry): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignCrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly DesignCrossCheckedEntry[] {
    return this.#values;
  }
}
