import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { Scenario } from "./scenario.ts";

// シナリオのファーストクラスコレクション。id 検索と id 列の導出を所有する。
export class Scenarios extends FirstClassCollectionBase<Scenario, Scenarios> implements FirstClassCollection<Scenario> {
  readonly #values: readonly Scenario[];

  private constructor(values: readonly Scenario[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-scenarios");
  }

  protected override rebuild(values: readonly Scenario[]): Scenarios {
    return new Scenarios(values);
  }

  static parse(values: readonly Scenario[]): Result<Scenarios, ParseError> {
    return parseConstruction(() => new Scenarios(values));
  }

  static of(values: readonly Scenario[]): Scenarios {
    return new Scenarios(values);
  }

  add(value: Scenario): Scenarios {
    return new Scenarios([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<Scenario> {
    yield* this.#values;
  }

  byId(id: string): Scenario | undefined {
    return this.#values.find((s) => s.id().asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id().asString());
  }

  toArray(): readonly Scenario[] {
    return this.#values;
  }
}
