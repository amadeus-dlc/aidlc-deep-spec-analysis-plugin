import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { combinedHash } from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributeNames } from "./attribute-names.ts";
import type { ComponentName } from "./component-name.ts";
import type { EntityName } from "./entity-name.ts";
import { XS_1, XS_2, XS_3 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";
import { WitnessReference } from "./witness-reference.ts";

// domain-design 側エンティティの素描。functional-design 側との被覆差分と
// カタログ位置ラベル（凍結書式）を所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DomainEntitySketchParam = {
  readonly name: EntityName;
  readonly component: ComponentName;
  readonly attributes: AttributeNames;
};

export class DomainEntitySketch {
  readonly #name: EntityName;
  readonly #component: ComponentName;
  readonly #attributes: AttributeNames;

  private constructor(seed: DomainEntitySketchParam) {
    this.#name = seed.name;
    this.#component = seed.component;
    this.#attributes = seed.attributes;
  }

  static of(seed: DomainEntitySketchParam): DomainEntitySketch {
    return new DomainEntitySketch(seed);
  }

  checkAgainst(
    unitEntities: SiblingUnitIndex,
    unit: UnitName | undefined,
    report: ReferenceCheckReport,
    componentsArtifact: ArtifactPath,
  ): void {
    const compArt = componentsArtifact.asString();
    const key = this.#name.normalized();
    const definers = unitEntities.definersOf(key).toStrings();
    if (definers.length >= 2) {
      report.finding(
        XS_1,
        FindingKind.consistencyMismatch(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []),
        [
          WitnessReference.at(compArt, this.catalogLabel()),
          ...definers.map((unit) =>
            WitnessReference.at(
              `construction/${unit}/functional-design/entities.md`,
              `entity ${this.#name.asString()}`,
            ),
          ),
        ],
        `domain entity "${this.#name.asString()}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`,
      );
    } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
      report.finding(
        XS_2,
        FindingKind.consistencyMismatch(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []),
        [WitnessReference.at(compArt, this.catalogLabel())],
        `domain entity "${this.#name.asString()}" is defined in no unit's entities.md — it was dropped on the way to functional design`,
      );
    }
    // XS-3: 属性の取り落としは素描が自分で告げる（このユニットの定義に対してのみ）。
    if (unit !== undefined) {
      const mine = unitEntities.entityDeclaredIn(unit, key);
      if (mine) {
        const dropped = this.attributesDroppedIn(mine.attributeNames());
        if (dropped.length > 0) {
          report.finding(
            XS_3,
            FindingKind.consistencyMismatch(),
            FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []),
            dropped.map((a) => WitnessReference.at(compArt, `entity ${this.#name.asString()}.attributes`, a)),
            `domain-design declares attribute(s) ${dropped.join(", ")} on "${this.#name.asString()}" that this unit's entities.md does not carry`,
          );
        }
      }
    }
  }

  name(): EntityName {
    return this.#name;
  }

  equals(other: DomainEntitySketch): boolean {
    return (
      this.#name.equals(other.#name) &&
      this.#component.equals(other.#component) &&
      this.#attributes.equals(other.#attributes)
    );
  }

  hashCode(): number {
    return combinedHash([this.#name.hashCode(), this.#component.hashCode(), this.#attributes.hashCode()]);
  }

  // 境界: witness に載るカタログ位置ラベル（凍結書式）。
  catalogLabel(): string {
    return `entity ${this.#name.asString()} (component ${this.#component.asString()})`;
  }

  // XS-3: このユニットの定義が落としている属性（値の昇順——凍結順）。
  attributesDroppedIn(unitAttrs: AttributeNames): string[] {
    return this.#attributes.namesNotCoveredBy(unitAttrs);
  }
}
