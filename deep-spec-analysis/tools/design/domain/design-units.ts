import { DesignUnit } from "./design-unit.ts";

// 設計ユニットのファーストクラスコレクション。ユニット名昇順の整列
// （DesignModel の組成不変条件）という集合の知識を所有する。
export class DesignUnits {
  readonly #values: readonly DesignUnit[];

  private constructor(values: readonly DesignUnit[]) {
    this.#values = values;
  }

  static of(values: readonly DesignUnit[]): DesignUnits {
    return new DesignUnits([...values]);
  }

  add(value: DesignUnit): DesignUnits {
    return new DesignUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignUnit> {
    yield* this.#values;
  }

  sortedByName(): DesignUnits {
    return new DesignUnits([...this.#values].sort((a, b) => (a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0)));
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly DesignUnit[] {
    return this.#values;
  }
}
