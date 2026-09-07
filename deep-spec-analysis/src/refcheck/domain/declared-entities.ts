import type { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import type { EntityDeclarations } from "./entity-declarations.ts";
import { FD_E1 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { RelationshipDeclarations } from "./relationship-declarations.ts";
import type { ShapeErrors } from "./shape-errors.ts";

// entities.md の宣言集合。参照解決・applies-to 解決・ライフサイクル対象の
// 選定はエンティティコレクションに委ね、最上位と各エンティティ配下の関係の
// 合成順（凍結）を所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DeclaredEntitiesParam = {
  readonly entities: EntityDeclarations;
  readonly rels: RelationshipDeclarations; // top-level relationships
  readonly shapeErrors: ShapeErrors;
};

export class DeclaredEntities {
  readonly #entities: EntityDeclarations;
  readonly #rels: RelationshipDeclarations;
  readonly #shapeErrors: ShapeErrors;

  private constructor(seed: DeclaredEntitiesParam) {
    this.#entities = seed.entities;
    this.#rels = seed.rels;
    this.#shapeErrors = seed.shapeErrors;
  }

  static of(seed: DeclaredEntitiesParam): DeclaredEntities {
    return new DeclaredEntities(seed);
  }

  entities(): EntityDeclarations {
    return this.#entities;
  }

  // 最上位＋各エンティティ配下の全関係宣言（旧 allRels の合成順）。
  allRels(): RelationshipDeclarations {
    return this.#entities.foldLeft(this.#rels, (all, entity) => all.concat(entity.rels()));
  }

  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#shapeErrors.recordIn(FD_E1, report, artifact);
    this.#entities.checkDuplicates(report, artifact);
    this.#entities.checkDuplicateAttributes(report, artifact);
    this.#entities.checkAttributes(report, artifact);
    this.allRels().checkAgainst(this.#entities, report, artifact);
  }
}
