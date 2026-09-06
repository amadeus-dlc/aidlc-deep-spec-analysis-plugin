import { KeyedIndex, type NormalizedName, type UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { EntityDeclaration } from "./entity-declaration.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import { UnitNames } from "./unit-names.ts";

// ユニットごとの宣言を保持し、正規化名から所有元と宣言を解決する。
export class SiblingUnitIndex {
  readonly #units: KeyedIndex<UnitName, KeyedIndex<NormalizedName, EntityDeclaration>>;

  /** XS一実行の予算はユニット数・実体宣言数それぞれ65,536件。索引化より先に検査する。 */
  private constructor(units: KeyedIndex<UnitName, EntityDeclarations>) {
    if (units.size() > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-sibling-units", raw: units.size() });
    let count = 0;
    for (const declarations of units.values())
      for (const _entity of declarations)
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "too-many-sibling-entities", raw: count });
    this.#units = KeyedIndex.of(
      [...units].map(
        ([unit, declarations]) =>
          [
            unit,
            KeyedIndex.of([...declarations].map((entity) => [entity.name().normalized(), entity] as const)),
          ] as const,
      ),
    );
  }

  static of(units: KeyedIndex<UnitName, EntityDeclarations>): SiblingUnitIndex {
    return new SiblingUnitIndex(units);
  }

  static parse(units: KeyedIndex<UnitName, EntityDeclarations>): Result<SiblingUnitIndex, ParseError> {
    return parseConstruction(() => new SiblingUnitIndex(units));
  }

  definersOf(normalizedName: NormalizedName): UnitNames {
    return UnitNames.of(
      [...this.#units].filter(([, declarations]) => declarations.has(normalizedName)).map(([unit]) => unit),
    );
  }

  entityDeclaredIn(unit: UnitName, normalizedName: NormalizedName): EntityDeclaration | undefined {
    return this.#units.get(unit)?.get(normalizedName);
  }

  hasAnyUnit(): boolean {
    return !this.#units.isEmpty();
  }
}
