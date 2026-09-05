import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// UnitName — unit-of-work 名のドメインプリミティブ。refcheck が検査対象の
// 帰属（functional センサーの unit キー、契約表の Provider/Consumer/Owner、
// units エッジブロックの宣言）として話す語彙。

export class UnitName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "unit-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-unit-name", raw });
    this.#value = raw;
  }

  static of(raw: string): UnitName {
    return new UnitName(raw);
  }

  static parse(raw: string): Result<UnitName, ParseError> {
    return parseConstruction(() => new UnitName(raw));
  }

  equals(other: UnitName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

