import { type CardinalityNotation } from "./cardinality-notation.ts";
import { type ElementPath } from "./element-path.ts";
import { type EntityName } from "./entity-name.ts";

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

  element(): ElementPath {
    return this.#element;
  }

  from(): EntityName | null {
    return this.#from;
  }

  to(): EntityName | null {
    return this.#to;
  }

  cardinality(): CardinalityNotation | null {
    return this.#cardinality;
  }

  cardinalityOutsideClosedSet(): boolean {
    return this.#cardinality !== null && !this.#cardinality.isInClosedSet();
  }

  cardinalityWithoutDirection(): boolean {
    return this.#cardinality !== null && !this.#hasDirection;
  }
}
