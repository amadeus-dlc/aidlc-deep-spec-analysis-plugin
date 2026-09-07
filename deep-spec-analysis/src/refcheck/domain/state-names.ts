import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { StateName } from "./state-name.ts";

export class StateNames
  extends FirstClassCollectionBase<StateName, StateNames>
  implements FirstClassCollection<StateName>
{
  readonly #values: readonly StateName[];

  private constructor(values: readonly StateName[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-state-names");
  }

  protected override rebuild(values: readonly StateName[]): StateNames {
    return new StateNames(values);
  }

  override map(transform: (element: StateName) => StateName): StateNames {
    return this.mapTo(transform, StateNames.of);
  }

  override combine(other: StateNames): StateNames {
    return this.combineTo(other, StateNames.of);
  }

  static parse(values: readonly StateName[]): Result<StateNames, ParseError> {
    return parseConstruction(() => new StateNames(values));
  }

  static of(values: readonly StateName[]): StateNames {
    return new StateNames(values);
  }

  add(value: StateName): StateNames {
    return new StateNames([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<StateName> {
    yield* this.#values;
  }

  toArray(): readonly StateName[] {
    return this.#values;
  }
}
