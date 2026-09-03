// UnitName — unit-of-work 名のドメインプリミティブ。refcheck が検査対象の
// 帰属（functional センサーの unit キー、契約表の Provider/Consumer/Owner、
// units エッジブロックの宣言）として話す語彙。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

type UnitNameError = { readonly kind: "empty-unit-name"; readonly raw: string };

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

  asString(): string {
    return this.#value;
  }
}

