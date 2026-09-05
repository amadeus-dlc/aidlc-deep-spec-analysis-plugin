import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import { DesignFindings } from "./design-findings.ts";
import type { DesignInputAnchors } from "./design-input-anchors.ts";
import type { DesignReport } from "./design-report.ts";
import type { DesignSkips } from "./design-skips.ts";
import type { UnitRefinementPlan } from "./unit-refinement-plan.ts";

// 適用不能の診断と、鮮度・所属を確認済みの検査計画を一緒に保つ。
export class RefinementPreparation {
  readonly #plans: readonly UnitRefinementPlan[];
  readonly #skipped: DesignSkips;
  readonly #inputs: DesignInputAnchors | null;

  /** 1実行の準備台帳は他の走査集合と同じ65,536ユニット。コピーより先に確認する。 */
  private constructor(plans: readonly UnitRefinementPlan[], skipped: DesignSkips, inputs: DesignInputAnchors | null) {
    if (plans.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-refinement-plans", raw: plans.length });
    this.#plans = [...plans];
    this.#skipped = skipped;
    this.#inputs = inputs;
  }

  static of(
    plans: readonly UnitRefinementPlan[],
    skipped: DesignSkips,
    inputs: DesignInputAnchors | null,
  ): RefinementPreparation {
    return new RefinementPreparation(plans, skipped, inputs);
  }

  static parse(
    plans: readonly UnitRefinementPlan[],
    skipped: DesignSkips,
    inputs: DesignInputAnchors | null,
  ): Result<RefinementPreparation, ParseError> {
    return parseConstruction(() => new RefinementPreparation(plans, skipped, inputs));
  }

  *[Symbol.iterator](): Iterator<UnitRefinementPlan> {
    yield* this.#plans;
  }

  recordedIn(report: DesignReport): DesignReport {
    const withSkips = report.withEvidence(DesignFindings.of([]), this.#skipped);
    return this.#inputs === null ? withSkips : withSkips.withInputs(this.#inputs);
  }
}
