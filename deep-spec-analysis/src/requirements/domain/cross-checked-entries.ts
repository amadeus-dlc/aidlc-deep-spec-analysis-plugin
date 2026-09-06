import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { CrossCheckedEntry } from "./cross-checked-entry.ts";

// クロスチェック判定表のファーストクラスコレクション。
export class CrossCheckedEntries implements FirstClassCollection, IterableFirstClassCollection<CrossCheckedEntry> {
  readonly #values: readonly CrossCheckedEntry[];

  private constructor(values: readonly CrossCheckedEntry[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly CrossCheckedEntry[]): CrossCheckedEntries {
    return new CrossCheckedEntries(values);
  }

  add(value: CrossCheckedEntry): CrossCheckedEntries {
    return new CrossCheckedEntries([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<CrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly CrossCheckedEntry[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
