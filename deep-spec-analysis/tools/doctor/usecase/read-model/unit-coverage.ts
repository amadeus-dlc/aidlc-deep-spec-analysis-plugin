// リードモデル（裁定 22）: 設計検証カバレッジの投影。domain 層の住人ではない。
import type { RefinementStaleRow } from "./refinement-stale-row.ts";
import type { UnitCoverageRow } from "./unit-coverage-row.ts";

// 設計検証カバレッジの査定集約（phase 2、unit 粒度）＋ refinement 失効
//（phase 3）。凍結順: refinement 失効行（走査順）→ unit 問題行 → 要約行。
export class UnitCoverage {
  readonly #eligible: number;
  readonly #problems: readonly UnitCoverageRow[];
  readonly #refinementStale: readonly RefinementStaleRow[];
  readonly #scopes: readonly string[];

  private constructor(props: {
    eligible: number;
    problems: readonly UnitCoverageRow[];
    refinementStale: readonly RefinementStaleRow[];
    scopes: readonly string[];
  }) {
    this.#eligible = props.eligible;
    this.#problems = props.problems;
    this.#refinementStale = props.refinementStale;
    this.#scopes = props.scopes;
  }

  static of(props: {
    eligible: number;
    problems: readonly UnitCoverageRow[];
    refinementStale: readonly RefinementStaleRow[];
    scopes: readonly string[];
  }): UnitCoverage {
    return new UnitCoverage({
      eligible: props.eligible,
      problems: [...props.problems],
      refinementStale: [...props.refinementStale],
      scopes: [...props.scopes],
    });
  }

  hasEligible(): boolean {
    return this.#eligible > 0;
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

  problems(): readonly UnitCoverageRow[] {
    return this.#problems;
  }

  refinementStale(): readonly RefinementStaleRow[] {
    return this.#refinementStale;
  }

  scopes(): readonly string[] {
    return this.#scopes;
  }
}
