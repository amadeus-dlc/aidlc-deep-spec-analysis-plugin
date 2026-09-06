import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import type { CardinalityNotation } from "./cardinality-notation.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import type { EntityName } from "./entity-name.ts";
import { FD_E4, FD_E5 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// 関係宣言。基数の閉集合整合と方向の宣言義務を自分で判定する（旧 FD-E5）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RelationshipDeclarationParam = {
  readonly element: ElementPath;
  readonly from: EntityName | null;
  readonly to: EntityName | null;
  readonly cardinality: CardinalityNotation | null;
  readonly hasDirection: boolean;
};

export class RelationshipDeclaration {
  readonly #element: ElementPath;
  readonly #from: EntityName | null;
  readonly #to: EntityName | null;
  readonly #cardinality: CardinalityNotation | null;
  readonly #hasDirection: boolean;

  private constructor(seed: RelationshipDeclarationParam) {
    this.#element = seed.element;
    this.#from = seed.from;
    this.#to = seed.to;
    this.#cardinality = seed.cardinality;
    this.#hasDirection = seed.hasDirection;
  }

  static of(seed: RelationshipDeclarationParam): RelationshipDeclaration {
    return new RelationshipDeclaration(seed);
  }

  checkAgainst(entities: EntityDeclarations, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const endpoint of [this.#from, this.#to]) {
      if (endpoint !== null && !entities.containsNamed(endpoint))
        report.finding(
          FD_E4,
          FindingKind.referenceBroken(),
          FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", endpoint.asString())), []),
          [WitnessReference.at(artifact.asString(), this.#element.asString(), endpoint.asString())],
          `relationship endpoint "${endpoint.asString()}" is not a declared entity`,
        );
    }
    if (this.cardinalityOutsideClosedSet())
      report.finding(
        FD_E5,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(FD_E5.asCheckTarget()), []),
        [WitnessReference.at(artifact.asString(), this.#element.asString(), this.#cardinality?.asString())],
        `cardinality "${this.#cardinality?.asString()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`,
      );
    if (this.cardinalityWithoutDirection())
      report.finding(
        FD_E5,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(FD_E5.asCheckTarget()), []),
        [WitnessReference.at(artifact.asString(), this.#element.asString())],
        "relationship declares a cardinality but no direction (from/to or direction key)",
      );
  }

  cardinalityOutsideClosedSet(): boolean {
    return this.#cardinality !== null && !this.#cardinality.isInClosedSet();
  }

  cardinalityWithoutDirection(): boolean {
    return this.#cardinality !== null && !this.#hasDirection;
  }
}
