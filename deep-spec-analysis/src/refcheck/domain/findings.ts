import type { Finding } from "./finding.ts";

// finding のファーストクラスコレクション。正準ソート（kind 順位 → targets →
// detail）は要素の `compareTo` に問う（kind 順位は kernel の FindingKind）。
export class Findings {
  readonly #values: readonly Finding[];

  private constructor(values: readonly Finding[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Finding[]): Findings {
    return new Findings(values);
  }

  add(value: Finding): Findings {
    return new Findings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Finding> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  sortedCanonically(): Findings {
    return new Findings([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly Finding[] {
    return this.#values;
  }
}
