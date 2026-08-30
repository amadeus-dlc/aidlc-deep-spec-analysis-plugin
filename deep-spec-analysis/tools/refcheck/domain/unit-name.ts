// UnitName — unit-of-work 名のドメインプリミティブ。refcheck が検査対象の
// 帰属（functional センサーの unit キー、契約表の Provider/Consumer/Owner、
// units エッジブロックの宣言）として話す語彙。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type UnitNameError = { readonly kind: "empty-unit-name"; readonly raw: string };

export class UnitName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<UnitName, UnitNameError> {
    if (raw === "") return err({ kind: "empty-unit-name", raw });
    return ok(new UnitName(raw));
  }

  static reconstitute(raw: string): UnitName {
    return new UnitName(raw);
  }

  equals(other: UnitName): boolean {
    return this.#value === other.#value;
  }

  value(): string {
    return this.#value;
  }
}

// unit 名のファーストクラスコレクション（depends_on の並びなど宣言順を保持）。
export class UnitNames {
  readonly #values: readonly UnitName[];

  private constructor(values: readonly UnitName[]) {
    this.#values = values;
  }

  static of(values: readonly UnitName[]): UnitNames {
    return new UnitNames([...values]);
  }

  static reconstitute(raws: readonly string[]): UnitNames {
    return new UnitNames(raws.map((r) => UnitName.reconstitute(r)));
  }

  add(value: UnitName): UnitNames {
    return new UnitNames([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitName> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((v) => v.value() === value);
  }

  // CD-3 の走査順（辞書順）はコレクション知識。
  sortedByValue(): UnitNames {
    return new UnitNames([...this.#values].sort((a, b) => (a.value() < b.value() ? -1 : 1)));
  }

  toArray(): readonly UnitName[] {
    return this.#values;
  }
}
