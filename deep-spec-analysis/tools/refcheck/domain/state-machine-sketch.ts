import { type MachineSpec } from "./machine-spec.ts";
import { type StateNames } from "./state-names.ts";
import type { StateMachineSketchSeed } from "./state-machine-sketch-seed.ts";

// 状態機械の素描。自分の位置ラベル（凍結書式）と spec 分解を所有する。
export class StateMachineSketch {
  readonly #seed: StateMachineSketchSeed;

  private constructor(seed: StateMachineSketchSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: StateMachineSketchSeed): StateMachineSketch {
    return new StateMachineSketch(seed);
  }

  spec(): MachineSpec {
    return this.#seed.spec;
  }

  states(): StateNames {
    return this.#seed.states;
  }

  unsupported(): string | null {
    return this.#seed.unsupported;
  }

  // 境界: witness と skip 文言に載る位置ラベル（凍結書式）。
  locationLabel(): string {
    return `State Machine: ${this.#seed.spec.asString()} (fence line ${this.#seed.fenceLine.asNumber()})`;
  }
}
