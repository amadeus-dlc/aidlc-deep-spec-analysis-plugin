import type { DeclaredEntitiesSeed } from "./declared-entities-seed.ts";
import { EntityDecls } from "./entity-decls.ts";
import { RelDecls } from "./rel-decls.ts";
import { ShapeErrors } from "./shape-errors.ts";

// entities.md の宣言集合。参照解決・applies-to 解決・ライフサイクル対象の
// 選定はエンティティコレクションに委ね、最上位と各エンティティ配下の関係の
// 合成順（凍結）を所有する。
export class DeclaredEntities {
  readonly #seed: DeclaredEntitiesSeed;

  private constructor(seed: DeclaredEntitiesSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: DeclaredEntitiesSeed): DeclaredEntities {
    return new DeclaredEntities(seed);
  }

  entities(): EntityDecls {
    return this.#seed.entities;
  }

  shapeErrors(): ShapeErrors {
    return this.#seed.shapeErrors;
  }

  // 最上位＋各エンティティ配下の全関係宣言（旧 allRels の合成順）。
  allRels(): RelDecls {
    let all = this.#seed.rels;
    for (const e of this.#seed.entities) all = all.concat(e.rels());
    return all;
  }
}
