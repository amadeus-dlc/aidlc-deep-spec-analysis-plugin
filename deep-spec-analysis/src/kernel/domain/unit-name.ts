import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// UnitName — unit-of-work 名のドメインプリミティブ。refcheck が検査対象の
// 帰属（functional センサーの unit キー、契約表の Provider/Consumer/Owner、
// units エッジブロックの宣言）として話す語彙。

export class UnitName {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-unit-name", raw });
    this.#value = raw;
  }

  static of(raw: string): UnitName {
    return new UnitName(raw);
  }

  static parse(raw: string): Result<UnitName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new UnitName(raw));
  }

  equals(other: UnitName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

