import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";

// クロスチェック判定表のファーストクラスコレクション。
export class DesignCrossCheckedEntries
  implements FirstClassCollection, IterableFirstClassCollection<DesignCrossCheckedEntry>
{
  readonly #values: readonly DesignCrossCheckedEntry[];

  private constructor(values: readonly DesignCrossCheckedEntry[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignCrossCheckedEntry[]): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries(values);
  }

  add(value: DesignCrossCheckedEntry): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignCrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly DesignCrossCheckedEntry[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
