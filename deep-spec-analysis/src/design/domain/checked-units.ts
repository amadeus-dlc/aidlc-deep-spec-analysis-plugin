import { TargetIdentifier, TargetIdentifiers, UnitName } from "@deep-spec/kernel-domain";

// CheckedUnits — 設計レポートの checked[]（検査済みユニット名）のファースト
// クラスコレクション。要素は UnitName（裁定 3-1、2026-09-03）。正準一意化は
// 文書の凍結正準形。

export class CheckedUnits {
  readonly #values: readonly UnitName[];

  private constructor(values: readonly UnitName[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly UnitName[]): CheckedUnits {
    return new CheckedUnits(values);
  }

  add(value: UnitName): CheckedUnits {
    return new CheckedUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitName> {
    yield* this.#values;
  }

  sortedUniqueCanonically(): CheckedUnits {
    return CheckedUnits.of(
      Array.from(
        TargetIdentifiers.of(Array.from(this.toStrings(), (raw) => TargetIdentifier.of(raw)))
          .sortedUniqueCanonically()
          .toStrings(),
        (raw) => UnitName.of(raw),
      ),
    );
  }

  toArray(): readonly UnitName[] {
    return this.#values;
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.map((v) => v.asString());
  }
}
