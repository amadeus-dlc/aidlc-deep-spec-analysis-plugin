import type { StateMachineSketches } from "./state-machine-sketches.ts";

// functional-spec.md の状態機械スケッチ——文書が無い（absent）か、読めた
// （present：機械群、空でもよい）。FD-S 検査は `match` で解釈へ命じる
// （#71 波26）。
export class FunctionalSpecOutcome {
  readonly #machines: StateMachineSketches | null;

  private constructor(machines: StateMachineSketches | null) {
    this.#machines = machines;
  }

  static absent(): FunctionalSpecOutcome {
    return new FunctionalSpecOutcome(null);
  }

  static present(machines: StateMachineSketches): FunctionalSpecOutcome {
    return new FunctionalSpecOutcome(machines);
  }

  match<T>(handlers: { absent: () => T; present: (machines: StateMachineSketches) => T }): T {
    return this.#machines === null ? handlers.absent() : handlers.present(this.#machines);
  }
}
