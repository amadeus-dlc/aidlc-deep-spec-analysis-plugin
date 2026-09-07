import {
  type ArtifactPath,
  type FirstClassCollection,
  FirstClassCollectionBase,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DomainEntitySketch } from "./domain-entity-sketch.ts";
import { XS_3 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";

// domain-design 側素描のコレクション。名前順の整列と正規化名での一意化
// （XS 検査の凍結挙動）を所有する。
export class DomainEntitySketches
  extends FirstClassCollectionBase<DomainEntitySketch, DomainEntitySketches>
  implements FirstClassCollection<DomainEntitySketch>
{
  readonly #values: readonly DomainEntitySketch[];

  private constructor(values: readonly DomainEntitySketch[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-domain-entity-sketches");
  }

  protected override rebuild(values: readonly DomainEntitySketch[]): DomainEntitySketches {
    return new DomainEntitySketches(values);
  }

  static parse(values: readonly DomainEntitySketch[]): Result<DomainEntitySketches, ParseError> {
    return parseConstruction(() => new DomainEntitySketches(values));
  }

  static of(values: readonly DomainEntitySketch[]): DomainEntitySketches {
    return new DomainEntitySketches(values);
  }

  add(value: DomainEntitySketch): DomainEntitySketches {
    return new DomainEntitySketches([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DomainEntitySketch> {
    yield* this.#values;
  }

  // 名前昇順に整列し、正規化名の初出だけを残す（XS の巡回順——凍結）。
  sortedDistinctByNormalizedName(): DomainEntitySketch[] {
    const sorted = [...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1));
    const seen = new Set<string>();
    const out: DomainEntitySketch[] = [];
    for (const de of sorted) {
      const key = de.name().normalized().asString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(de);
    }
    return out;
  }

  toArray(): readonly DomainEntitySketch[] {
    return this.#values;
  }

  // XS-1..XS-3 の不変条件（種別規律の裁定 13）: domain-design の実体は
  // ちょうど一つのユニットが定義し（XS-1 重複／XS-2 脱落）、このユニットの
  // entities.md は属性を取り落とさない（XS-3、unit が判るときだけ）。走査は
  // 正規化名で一意化した名前順（凍結）。文言は golden 凍結。
  check(
    report: ReferenceCheckReport,
    componentsArtifact: ArtifactPath,
    unitEntities: SiblingUnitIndex,
    unit: UnitName | undefined,
  ): void {
    for (const declaration of this.sortedDistinctByNormalizedName())
      declaration.checkAgainst(unitEntities, unit, report, componentsArtifact);
    if (unit === undefined) {
      report.skip(
        XS_3,
        "unrecognized-format",
        "the unit for this functional-design record could not be determined from its path",
      );
    }
  }
}
