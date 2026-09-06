import {
  type ArtifactPath,
  type AttributePath,
  FindingKind,
  FindingTargets,
  FunctionalRequirementReferences,
  TargetIdentifier,
  type TriggerName,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";

import type { AttributeMappings } from "./attribute-mappings.ts";
import { DesignFinding } from "./design-finding.ts";
import type { DesignUnitIdentifier } from "./design-unit-identifier.ts";
import { DesignWitness } from "./design-witness.ts";
import type { EventMapping } from "./event-mapping.ts";
import type { EventMappings } from "./event-mappings.ts";
import type { UnmappedDeclarations } from "./unmapped-declarations.ts";

// refinement map の 1 ユニット分——属性写像・イベント写像・unmapped 宣言。
// 計画はユニットの一致を問い、トリガのイベント写像を引く（#71 波24）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementUnitMapParam = {
  unit: DesignUnitIdentifier;
  attrMap: AttributeMappings;
  eventMap: EventMappings;
  unmapped: UnmappedDeclarations;
};

export class RefinementUnitMap {
  readonly #unit: DesignUnitIdentifier;
  readonly #attrMap: AttributeMappings;
  readonly #eventMap: EventMappings;
  readonly #unmapped: UnmappedDeclarations;

  private constructor(props: RefinementUnitMapParam) {
    this.#unit = props.unit;
    this.#attrMap = props.attrMap;
    this.#eventMap = props.eventMap;
    this.#unmapped = props.unmapped;
  }

  static of(props: RefinementUnitMapParam): RefinementUnitMap {
    return new RefinementUnitMap(props);
  }

  gapFor(
    targets: FindingTargets,
    detail: string,
    artifact: ArtifactPath,
    references = FunctionalRequirementReferences.of([]),
  ): DesignFinding {
    return DesignFinding.of({
      kind: FindingKind.mappingGap(),
      functionalRequirementReferences: references.sortedUnique(),
      targets: targets.sortedUniqueCanonically(),
      witness: DesignWitness.refs([{ artifact: artifact.asString(), element: `units[${this.#unit.asString()}]` }]),
      unit: UnitName.of(this.#unit.asString()),
      detail,
    });
  }
  attributeGap(path: AttributePath, detail: string, artifact: ArtifactPath): DesignFinding {
    return this.gapFor(
      FindingTargets.of(TargetIdentifier.of(`attr:${path.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`), []),
      detail,
      artifact,
    );
  }

  isForUnit(unit: DesignUnitIdentifier): boolean {
    return this.#unit.equals(unit);
  }

  attrMap(): AttributeMappings {
    return this.#attrMap;
  }

  eventMappingOf(trigger: TriggerName): EventMapping | undefined {
    return this.#eventMap.ofTrigger(trigger);
  }

  unmapped(): UnmappedDeclarations {
    return this.#unmapped;
  }
}
