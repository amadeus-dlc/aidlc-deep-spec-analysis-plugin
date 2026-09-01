import { StateMachineSketch } from "./state-machine-sketch.ts";

export class StateMachineSketches {
  readonly #values: readonly StateMachineSketch[];

  private constructor(values: readonly StateMachineSketch[]) {
    this.#values = values;
  }

  static of(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches([...values]);
  }

  add(value: StateMachineSketch): StateMachineSketches {
    return new StateMachineSketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<StateMachineSketch> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly StateMachineSketch[] {
    return this.#values;
  }
}
