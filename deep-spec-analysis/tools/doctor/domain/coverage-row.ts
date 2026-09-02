import type { CoverageState } from "./coverage-state.ts";

// 要件検証カバレッジの問題行——どの intent が、未検証か失効か。presenter は
// 状態を `matchState` で解釈し、intent ラベルを行に作らせる（#71 波27）。
export class CoverageRow {
  readonly #space: string;
  readonly #intent: string;
  readonly #state: CoverageState;

  private constructor(props: { space: string; intent: string; state: CoverageState }) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#state = props.state;
  }

  static reconstitute(props: { space: string; intent: string; state: CoverageState }): CoverageRow {
    return new CoverageRow(props);
  }

  intent(): string {
    return this.#intent;
  }

  intentLabel(): string {
    return `${this.#space}/${this.#intent}`;
  }

  matchState<T>(handlers: { unverified: () => T; stale: () => T }): T {
    return this.#state.match(handlers);
  }
}
