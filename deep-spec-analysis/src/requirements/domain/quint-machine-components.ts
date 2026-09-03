import { ObligationIds } from "./obligation-ids.ts";
import type { QuintMachineComponent } from "./quint-machine-component.ts";
import type { TraceState } from "./trace-state.ts";

// 不変量成分のファーストクラスコレクション。帰属評価（どの成分が最終状態で
// 破れているか）は成分集合自身の知識で、個々の破れは成分に問う。
export class QuintMachineComponents {
  readonly #values: readonly QuintMachineComponent[];

  private constructor(values: readonly QuintMachineComponent[]) {
    this.#values = values;
  }

  static of(values: readonly QuintMachineComponent[]): QuintMachineComponents {
    return new QuintMachineComponents([...values]);
  }

  add(value: QuintMachineComponent): QuintMachineComponents {
    return new QuintMachineComponents([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<QuintMachineComponent> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  ids(): ObligationIds {
    return ObligationIds.of(this.#values.map((c) => c.id()));
  }

  violatedBy(state: TraceState): QuintMachineComponents {
    return new QuintMachineComponents(this.#values.filter((c) => c.isViolatedIn(state)));
  }

  toArray(): readonly QuintMachineComponent[] {
    return this.#values;
  }
}
