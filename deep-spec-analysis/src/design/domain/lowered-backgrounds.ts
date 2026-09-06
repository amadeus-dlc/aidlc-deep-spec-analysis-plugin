import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { LoweredBackground } from "./lowered-background.ts";

// lowered 背景のファーストクラスコレクション（BG-n 採番順を保持）。
export class LoweredBackgrounds implements FirstClassCollection, IterableFirstClassCollection<LoweredBackground> {
  readonly #values: readonly LoweredBackground[];

  private constructor(values: readonly LoweredBackground[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly LoweredBackground[]): LoweredBackgrounds {
    return new LoweredBackgrounds(values);
  }

  add(value: LoweredBackground): LoweredBackgrounds {
    return new LoweredBackgrounds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredBackground> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredBackground[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
