import { UnitName } from "@deep-spec/kernel-domain";

// unit 名のファーストクラスコレクション（depends_on の並びなど宣言順を保持）。
export class UnitNames {
  readonly #values: readonly UnitName[];

  private constructor(values: readonly UnitName[]) {
    this.#values = values;
  }

  static of(values: readonly UnitName[]): UnitNames {
    return new UnitNames([...values]);
  }

  add(value: UnitName): UnitNames {
    return new UnitNames([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitName> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((v) => v.asString() === value);
  }

  // CD-3 の走査順（辞書順）はコレクション知識。
  sortedByValue(): UnitNames {
    return new UnitNames([...this.#values].sort((a, b) => (a.asString() < b.asString() ? -1 : 1)));
  }

  toArray(): readonly UnitName[] {
    return this.#values;
  }
}
