import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RefinementScenario } from "./refinement-scenario.ts";

// 要件シナリオのファーストクラスコレクション。id 索引は最後の宣言が勝つ。
export class RefinementScenarios extends FirstClassCollectionBase<RefinementScenario, RefinementScenarios> {
  readonly #values: readonly RefinementScenario[];

  private constructor(values: readonly RefinementScenario[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-refinement-scenarios");
  }

  protected override rebuild(values: readonly RefinementScenario[]): RefinementScenarios {
    return new RefinementScenarios(values);
  }

  static of(values: readonly RefinementScenario[]): RefinementScenarios {
    return new RefinementScenarios(values);
  }

  static parse(values: readonly RefinementScenario[]): Result<RefinementScenarios, ParseError> {
    return parseConstruction(() => new RefinementScenarios(values));
  }

  add(value: RefinementScenario): RefinementScenarios {
    return new RefinementScenarios([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RefinementScenario> {
    yield* this.#values;
  }

  byId(id: string): RefinementScenario | undefined {
    let found: RefinementScenario | undefined;
    for (const s of this.#values) {
      if (s.id().asString() === id) found = s;
    }
    return found;
  }

  sortedCanonically(): RefinementScenarios {
    return new RefinementScenarios(
      [...this.#values].sort((a, b) => a.id().asTargetId().compareTo(b.id().asTargetId())),
    );
  }

  toArray(): readonly RefinementScenario[] {
    return this.#values;
  }
}
