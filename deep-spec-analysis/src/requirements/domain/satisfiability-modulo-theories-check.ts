import type { ErrorMessage } from "@deep-spec/kernel-domain";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import type { SatisfiabilityModuloTheoriesVerificationPlan } from "./satisfiability-modulo-theories-verification-plan.ts";
import { VerificationReport } from "./verification-report.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";

type SatisfiabilityModuloTheoriesCheckParam = {
  readonly plan: SatisfiabilityModuloTheoriesVerificationPlan;
  readonly result:
    | { readonly kind: "unavailable"; readonly reason: ErrorMessage }
    | { readonly kind: "solved"; readonly verdicts: SatisfiabilityModuloTheoriesQueryVerdicts };
};

// solverの可用性と計画時skipを合わせて保持し、結果の解釈を完結する。
export class SatisfiabilityModuloTheoriesCheck {
  readonly #plan: SatisfiabilityModuloTheoriesVerificationPlan;
  readonly #result: SatisfiabilityModuloTheoriesCheckParam["result"];

  private constructor(input: SatisfiabilityModuloTheoriesCheckParam) {
    this.#plan = input.plan;
    this.#result = { ...input.result };
  }

  static of(input: SatisfiabilityModuloTheoriesCheckParam): SatisfiabilityModuloTheoriesCheck {
    return new SatisfiabilityModuloTheoriesCheck(input);
  }

  reportFor(model: RequirementsModel, id: VerificationReportIdentifier): VerificationReport {
    if (this.#result.kind === "unavailable") {
      return VerificationReport.solverUnavailable(id, model, this.#plan.planSkipped(), this.#result.reason.asString());
    }
    const interpreted = this.#plan.interpret(model, this.#result.verdicts);
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "exhaustive",
      findings: interpreted.findings,
      skipped: interpreted.skipped,
    });
  }

  match<T>(cases: { unavailable: () => T; solved: () => T }): T {
    return this.#result.kind === "unavailable" ? cases.unavailable() : cases.solved();
  }
}
