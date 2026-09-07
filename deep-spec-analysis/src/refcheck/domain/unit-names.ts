import { type FirstClassCollection, FirstClassCollectionBase, type UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { UnitDeclarations } from "./unit-declarations.ts";

// unit 名のファーストクラスコレクション（depends_on の並びなど宣言順を保持）。
export class UnitNames extends FirstClassCollectionBase<UnitName, UnitNames> implements FirstClassCollection<UnitName> {
  readonly #values: readonly UnitName[];

  private constructor(values: readonly UnitName[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-unit-names");
  }

  protected override rebuild(values: readonly UnitName[]): UnitNames {
    return new UnitNames(values);
  }

  override map(transform: (element: UnitName) => UnitName): UnitNames {
    return this.mapTo(transform, UnitNames.of);
  }

  override combine(other: UnitNames): UnitNames {
    return this.combineTo(other, UnitNames.of);
  }

  static parse(values: readonly UnitName[]): Result<UnitNames, ParseError> {
    return parseConstruction(() => new UnitNames(values));
  }

  static of(values: readonly UnitName[]): UnitNames {
    return new UnitNames(values);
  }

  add(value: UnitName): UnitNames {
    return new UnitNames([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<UnitName> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((v) => v.asString() === value);
  }

  // CD-3 の走査順（辞書順）はコレクション知識。
  sortedByValue(): UnitNames {
    return new UnitNames([...this.#values].sort((a, b) => (a.asString() < b.asString() ? -1 : 1)));
  }

  // CD-3: 宣言済みユニットへの依存先だけを走査順のまま（未宣言の辺は落とす——凍結挙動）。
  declaredIn(declared: UnitDeclarations): readonly UnitName[] {
    return this.#values.filter((name) => declared.declares(name.asString()));
  }

  // 境界: 描画専用。unit 名を保持順のまま文字列にする。
  toStrings(): readonly string[] {
    return this.#values.map((name) => name.asString());
  }

  toArray(): readonly UnitName[] {
    return this.#values;
  }
}
