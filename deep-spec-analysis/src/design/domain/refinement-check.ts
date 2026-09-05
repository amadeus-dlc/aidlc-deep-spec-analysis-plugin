import { type ErrorMessage, SkipReason } from "@deep-spec/kernel-domain";
import type { DesignReport } from "./design-report.ts";
import type { RefinementQueryVerdicts } from "./refinement-query-verdicts.ts";
import type { RefinementSolverPlan } from "./refinement-solver-plan.ts";
import type { UnitRefinementPlan } from "./unit-refinement-plan.ts";

type RefinementCheckState =
  | { kind: "no-queries" }
  | { kind: "unavailable"; reason: ErrorMessage }
  | { kind: "solved"; verdicts: RefinementQueryVerdicts };

// unavailableでは準備中のgap/status/compile診断を採用しない。結果自身の契約。
export class RefinementCheck {
  readonly #plan: RefinementSolverPlan;
  readonly #preparation: UnitRefinementPlan;
  readonly #state: RefinementCheckState;

  private constructor(plan: RefinementSolverPlan, state: RefinementCheckState) {
    this.#plan = plan;
    this.#preparation = plan.preparation();
    this.#state = state;
  }

  static noQueries(plan: RefinementSolverPlan): RefinementCheck {
    return new RefinementCheck(plan, { kind: "no-queries" });
  }

  static unavailable(plan: RefinementSolverPlan, reason: ErrorMessage): RefinementCheck {
    return new RefinementCheck(plan, { kind: "unavailable", reason });
  }

  static solved(plan: RefinementSolverPlan, verdicts: RefinementQueryVerdicts): RefinementCheck {
    return new RefinementCheck(plan, { kind: "solved", verdicts });
  }

  recordedIn(report: DesignReport): DesignReport {
    const preparation = this.#preparation;
    if (this.#state.kind === "unavailable")
      return preparation.unverifiedIn(report, SkipReason.unavailable(), this.#state.reason.asString());
    const unit = preparation.unit();
    let result = report.withEvidence(
      preparation.gaps(),
      preparation.smtStatusSkips(unit.name()).concat(this.#plan.compileSkips()),
    );
    if (this.#state.kind === "solved") {
      const interpreted = this.#plan.interpret(this.#state.verdicts);
      result = result.withEvidence(interpreted.findings, interpreted.skipped);
    }
    return result;
  }
}
