import type { CoverageRow } from "./coverage-row.ts";

// 要件検証カバレッジの査定集約——適格 intent 数・問題行・対象スコープ。
// late adoption を安全にする観測面（未検証は「思い出す」のでなく「告げられる」）。
export class CoverageAssessment {
  readonly #eligible: number;
  readonly #problems: readonly CoverageRow[];
  readonly #scopes: readonly string[];

  private constructor(props: { eligible: number; problems: readonly CoverageRow[]; scopes: readonly string[] }) {
    this.#eligible = props.eligible;
    this.#problems = props.problems;
    this.#scopes = props.scopes;
  }

  static of(props: { eligible: number; problems: readonly CoverageRow[]; scopes: readonly string[] }): CoverageAssessment {
    return new CoverageAssessment({ eligible: props.eligible, problems: [...props.problems], scopes: [...props.scopes] });
  }

  isClean(): boolean {
    return this.#problems.length === 0;
  }

  verifiedCount(): number {
    return this.#eligible - this.#problems.length;
  }

  eligibleCount(): number {
    return this.#eligible;
  }

  problems(): readonly CoverageRow[] {
    return this.#problems;
  }

  scopes(): readonly string[] {
    return this.#scopes;
  }
}
