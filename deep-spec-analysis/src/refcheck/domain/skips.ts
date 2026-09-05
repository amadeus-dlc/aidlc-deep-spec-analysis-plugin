import type { Skipped } from "./skipped.ts";

// skip 記録のファーストクラスコレクション。正準ソート（target → reason）を
// 所有する。
export class Skips {
  readonly #values: readonly Skipped[];

  private constructor(values: readonly Skipped[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Skipped[]): Skips {
    return new Skips(values);
  }

  add(value: Skipped): Skips {
    return new Skips([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Skipped> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Skips {
    return new Skips(
      [...this.#values].sort((a, b) => a.compareTo(b)),
    );
  }

  toArray(): readonly Skipped[] {
    return this.#values;
  }
}
