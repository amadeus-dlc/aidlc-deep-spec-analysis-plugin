import { type CardinalityNotation } from "./cardinality-notation.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";
import type { RelDeclSeed } from "./rel-decl-seed.ts";

// 関係宣言。基数の閉集合整合と方向の宣言義務を自分で判定する（旧 FD-E5）。
export class RelDecl {
  readonly #seed: RelDeclSeed;

  private constructor(seed: RelDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: RelDeclSeed): RelDecl {
    return new RelDecl(seed);
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  from(): EntityName | null {
    return this.#seed.from;
  }

  to(): EntityName | null {
    return this.#seed.to;
  }

  cardinality(): CardinalityNotation | null {
    return this.#seed.cardinality;
  }

  cardinalityOutsideClosedSet(): boolean {
    return this.#seed.cardinality !== null && !this.#seed.cardinality.isInClosedSet();
  }

  cardinalityWithoutDirection(): boolean {
    return this.#seed.cardinality !== null && !this.#seed.hasDirection;
  }
}
