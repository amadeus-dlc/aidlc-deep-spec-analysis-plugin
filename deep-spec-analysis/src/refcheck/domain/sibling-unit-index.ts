import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeyedIndex,
  type NormalizedName,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { EntityDeclaration } from "./entity-declaration.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import { SiblingUnitIndexEntry } from "./sibling-unit-index-entry.ts";
import { UnitNames } from "./unit-names.ts";

// ユニットごとの宣言を保持し、正規化名から所有元と宣言を解決する。
export class SiblingUnitIndex
  extends FirstClassCollectionBase<SiblingUnitIndexEntry, SiblingUnitIndex>
  implements FirstClassCollection<SiblingUnitIndexEntry>
{
  readonly #units: KeyedIndex<UnitName, KeyedIndex<NormalizedName, EntityDeclaration>>;
  readonly #entries: readonly SiblingUnitIndexEntry[];

  /** XS一実行の予算はユニット数・実体宣言数それぞれ65,536件。索引化より先に検査する。 */
  private constructor(entries: Iterable<SiblingUnitIndexEntry>) {
    super();
    const owned: SiblingUnitIndexEntry[] = [];
    const unitNames = new Set<string>();
    let count = 0;
    for (const entry of entries) {
      if (owned.length >= 65_536)
        throw new IllegalArgumentException({ kind: "too-many-sibling-units", raw: owned.length + 1 });
      const unitName = entry.unit().asString();
      if (unitNames.has(unitName))
        throw new IllegalArgumentException({ kind: "duplicate-sibling-unit", raw: unitName });
      unitNames.add(unitName);
      for (const _entity of entry.declarations())
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "too-many-sibling-entities", raw: count });
      owned.push(entry);
    }
    this.#entries = Object.freeze(owned);
    this.#units = KeyedIndex.of(
      owned.map(
        (entry) =>
          [
            entry.unit(),
            KeyedIndex.of([...entry.declarations()].map((entity) => [entity.name().normalized(), entity] as const)),
          ] as const,
      ),
    );
  }

  protected override rebuild(values: readonly SiblingUnitIndexEntry[]): SiblingUnitIndex {
    return new SiblingUnitIndex(values);
  }

  override map(transform: (element: SiblingUnitIndexEntry) => SiblingUnitIndexEntry): SiblingUnitIndex {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }

  override combine(other: SiblingUnitIndex): SiblingUnitIndex {
    return this.combineTo(other, (values) => this.rebuild(values));
  }

  override *[Symbol.iterator](): Iterator<SiblingUnitIndexEntry> {
    yield* this.#entries;
  }

  toArray(): readonly SiblingUnitIndexEntry[] {
    return this.#entries;
  }

  static of(units: KeyedIndex<UnitName, EntityDeclarations>): SiblingUnitIndex {
    return new SiblingUnitIndex(SiblingUnitIndex.entriesOf(units));
  }

  static parse(units: KeyedIndex<UnitName, EntityDeclarations>): Result<SiblingUnitIndex, ParseError> {
    return parseConstruction(() => new SiblingUnitIndex(SiblingUnitIndex.entriesOf(units)));
  }

  private static *entriesOf(units: KeyedIndex<UnitName, EntityDeclarations>): Iterable<SiblingUnitIndexEntry> {
    for (const [unit, declarations] of units) yield SiblingUnitIndexEntry.of(unit, declarations);
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
