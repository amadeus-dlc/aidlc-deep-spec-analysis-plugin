import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { ObligationIdentifiers } from "./obligation-identifiers.ts";
import type { QuintMachineComponent } from "./quint-machine-component.ts";
import type { TraceState } from "./trace-state.ts";

// 不変量成分のファーストクラスコレクション。帰属評価（どの成分が最終状態で
// 破れているか）は成分集合自身の知識で、個々の破れは成分に問う。
export class QuintMachineComponents
  extends FirstClassCollectionBase<QuintMachineComponent, QuintMachineComponents>
  implements FirstClassCollection<QuintMachineComponent>
{
  readonly #values: readonly QuintMachineComponent[];

  private constructor(values: readonly QuintMachineComponent[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-quint-machine-components");
  }

  protected override rebuild(values: readonly QuintMachineComponent[]): QuintMachineComponents {
    return new QuintMachineComponents(values);
  }

  static parse(values: readonly QuintMachineComponent[]): Result<QuintMachineComponents, ParseError> {
    return parseConstruction(() => new QuintMachineComponents(values));
  }

  static of(values: readonly QuintMachineComponent[]): QuintMachineComponents {
    return new QuintMachineComponents(values);
  }

  add(value: QuintMachineComponent): QuintMachineComponents {
    return new QuintMachineComponents([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<QuintMachineComponent> {
    yield* this.#values;
  }

  ids(): ObligationIdentifiers {
    return ObligationIdentifiers.of(this.#values.map((c) => c.id()));
  }

  violatedBy(state: TraceState): QuintMachineComponents {
    return new QuintMachineComponents(this.#values.filter((c) => c.isViolatedIn(state)));
  }

  toArray(): readonly QuintMachineComponent[] {
    return this.#values;
  }
}
