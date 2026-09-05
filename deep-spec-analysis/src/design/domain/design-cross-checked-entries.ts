import type { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";

// クロスチェック判定表のファーストクラスコレクション。
export class DesignCrossCheckedEntries {
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
}
