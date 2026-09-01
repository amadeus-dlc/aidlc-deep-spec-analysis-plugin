import { IdOrder } from "../../kernel/domain/index.ts";
import type { Skipped } from "./skipped.ts";

// skip 記録のファーストクラスコレクション。正準ソート（target → reason）を
// 所有する。
export class Skips {
  readonly #values: readonly Skipped[];

  private constructor(values: readonly Skipped[]) {
    this.#values = values;
  }

  static of(values: readonly Skipped[]): Skips {
    return new Skips([...values]);
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
      [...this.#values].sort((a, b) => {
        const c = IdOrder.compare(a.target, b.target);
        if (c !== 0) return c;
        return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
      }),
    );
  }

  toArray(): readonly Skipped[] {
    return this.#values;
  }
}
