import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { AllowedValue } from "./allowed-value.ts";
import type { StateNames } from "./state-names.ts";

export class AllowedValues
  extends FirstClassCollectionBase<AllowedValue, AllowedValues>
  implements FirstClassCollection<AllowedValue>
{
  readonly #values: readonly AllowedValue[];

  private constructor(values: readonly AllowedValue[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-allowed-values");
  }

  protected rebuild(values: readonly AllowedValue[]): AllowedValues {
    return new AllowedValues(values);
  }

  static parse(values: readonly AllowedValue[]): Result<AllowedValues, ParseError> {
    return parseConstruction(() => new AllowedValues(values));
  }

  static of(values: readonly AllowedValue[]): AllowedValues {
    return new AllowedValues(values);
  }

  add(value: AllowedValue): AllowedValues {
    return new AllowedValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AllowedValue> {
    yield* this.#values;
  }

  containsValue(raw: string): boolean {
    return this.#values.some((v) => v.asString() === raw);
  }

  // FD-S1: 図の状態のうち許容値に無いもの（正規化照合・値の昇順——凍結順）。
  rogueAmong(states: StateNames): string[] {
    const norm = new Set(this.#values.map((v) => v.normalized().asString()));
    return states
      .toArray()
      .filter((s) => !norm.has(s.normalized().asString()))
      .map((s) => s.asString())
      .sort();
  }

  // FD-S2: 許容値のうちどの図状態にも現れないもの。
  absentFrom(states: StateNames): string[] {
    const stateNorm = new Set(states.toArray().map((s) => s.normalized().asString()));
    return this.#values
      .filter((v) => !stateNorm.has(v.normalized().asString()))
      .map((v) => v.asString())
      .sort();
  }

  toArray(): readonly AllowedValue[] {
    return this.#values;
  }
}
