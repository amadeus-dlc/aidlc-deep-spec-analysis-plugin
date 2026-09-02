import { TargetIds } from "../../kernel/domain/index.ts";

// 検査済みユニット面のファーストクラスコレクション。id 順の一意整列
// （compose の不変条件）を所有する。
export class CheckedUnits {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): CheckedUnits {
    return new CheckedUnits([...values]);
  }

  add(value: string): CheckedUnits {
    return new CheckedUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  sortedUniqueCanonically(): CheckedUnits {
    return new CheckedUnits(TargetIds.reconstitute([...this.#values]).sortedUniqueCanonically().toStrings());
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
