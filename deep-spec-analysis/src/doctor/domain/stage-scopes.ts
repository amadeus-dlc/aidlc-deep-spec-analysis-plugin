import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { StageScope } from "./stage-scope.ts";

export class StageScopes
  extends FirstClassCollectionBase<StageScope, StageScopes>
  implements FirstClassCollection<StageScope>
{
  readonly #values: readonly StageScope[];
  /** stage宣言の処理予算は1,024スコープ。 */
  private constructor(values: readonly StageScope[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 1_024, "too-many-stage-scopes");
  }

  protected override rebuild(values: readonly StageScope[]): StageScopes {
    return new StageScopes(values);
  }
  static of(values: readonly StageScope[]): StageScopes {
    return new StageScopes(values);
  }
  override map(transform: (element: StageScope) => StageScope): StageScopes {
    return this.mapTo(transform, StageScopes.of);
  }

  override combine(other: StageScopes): StageScopes {
    return this.combineTo(other, StageScopes.of);
  }

  static parse(values: readonly StageScope[]): Result<StageScopes, ParseError> {
    return parseConstruction(() => new StageScopes(values));
  }
  override *[Symbol.iterator](): Iterator<StageScope> {
    yield* this.#values;
  }
}
