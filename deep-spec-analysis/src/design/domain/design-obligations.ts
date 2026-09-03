import type { DesignObligation } from "./design-obligation.ts";

// 設計義務のファーストクラスコレクション。id 列の導出を所有する。
export class DesignObligations {
  readonly #values: readonly DesignObligation[];

  private constructor(values: readonly DesignObligation[]) {
    this.#values = values;
  }

  static of(values: readonly DesignObligation[]): DesignObligations {
    return new DesignObligations([...values]);
  }

  add(value: DesignObligation): DesignObligations {
    return new DesignObligations([...this.#values, value]);
  }

  // lowering の凍結順：id の正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignObligations {
    return new DesignObligations([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  *[Symbol.iterator](): Iterator<DesignObligation> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id().asString());
  }

  toArray(): readonly DesignObligation[] {
    return this.#values;
  }
}
