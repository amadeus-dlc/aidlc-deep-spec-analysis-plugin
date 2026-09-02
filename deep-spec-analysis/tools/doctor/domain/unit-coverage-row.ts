import type { CoverageState } from "./coverage-state.ts";

// 設計検証カバレッジの問題行——どの intent のどのユニットが、未検証か失効か。
// presenter は状態を `matchState` で解釈し、ユニットラベルを行に作らせる
// （#71 波27）。
export class UnitCoverageRow {
  readonly #space: string;
  readonly #intent: string;
  readonly #unit: string;
  readonly #state: CoverageState;

  private constructor(props: { space: string; intent: string; unit: string; state: CoverageState }) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#unit = props.unit;
    this.#state = props.state;
  }

  static reconstitute(props: { space: string; intent: string; unit: string; state: CoverageState }): UnitCoverageRow {
    return new UnitCoverageRow(props);
  }

  intent(): string {
    return this.#intent;
  }

  unitLabel(): string {
    return `${this.#space}/${this.#intent}/${this.#unit}`;
  }

  matchState<T>(handlers: { unverified: () => T; stale: () => T }): T {
    return this.#state.match(handlers);
  }
}
