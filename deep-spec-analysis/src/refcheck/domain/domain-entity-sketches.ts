import { DomainEntitySketch } from "./domain-entity-sketch.ts";
import { FindingKind, TargetIds, type ArtifactPath } from "@deep-spec/kernel-domain";
import { XS_1, XS_2, XS_3 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { UnitName } from "@deep-spec/kernel-domain";
import { WitnessRef } from "./witness-ref.ts";

// domain-design 側素描のコレクション。名前順の整列と正規化名での一意化
// （XS 検査の凍結挙動）を所有する。
export class DomainEntitySketches {
  readonly #values: readonly DomainEntitySketch[];

  private constructor(values: readonly DomainEntitySketch[]) {
    this.#values = values;
  }

  static of(values: readonly DomainEntitySketch[]): DomainEntitySketches {
    return new DomainEntitySketches([...values]);
  }

  add(value: DomainEntitySketch): DomainEntitySketches {
    return new DomainEntitySketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DomainEntitySketch> {
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
  check(report: ReferenceCheckReport, componentsArtifact: ArtifactPath, unitEntities: SiblingUnitIndex, unit: UnitName | undefined): void {
    const compArt = componentsArtifact.asString();
    // 正規化名での一意化と整列はコレクションが所有する（重複宣言そのものは
    // DD-5 の finding）。
    for (const de of this.sortedDistinctByNormalizedName()) {
      const key = de.name().normalized().asString();
      const definers = unitEntities.definersOf(key);
      if (definers.length >= 2) {
        report.finding(XS_1, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())],
          [WitnessRef.at(compArt, de.catalogLabel()),
            ...definers.map((u) => WitnessRef.at(`construction/${u}/functional-design/entities.md`, `entity ${de.name().asString()}`))],
          `domain entity "${de.name().asString()}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`);
      } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
        report.finding(XS_2, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())],
          [WitnessRef.at(compArt, de.catalogLabel())],
          `domain entity "${de.name().asString()}" is defined in no unit's entities.md — it was dropped on the way to functional design`);
      }
      // XS-3: 属性の取り落としは素描が自分で告げる（このユニットの定義に対してのみ）。
      if (unit !== undefined) {
        const mine = unitEntities.entityDeclaredIn(unit.asString(), key);
        if (mine) {
          const dropped = de.attributesDroppedIn(mine.attrs);
          if (dropped.length > 0) {
            report.finding(XS_3, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())],
              dropped.map((a) => WitnessRef.at(compArt, `entity ${de.name().asString()}.attributes`, a)),
              `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name().asString()}" that this unit's entities.md does not carry`);
          }
        }
      }
    }
    if (unit === undefined) {
      report.skip(XS_3, "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
    }
  }
}
