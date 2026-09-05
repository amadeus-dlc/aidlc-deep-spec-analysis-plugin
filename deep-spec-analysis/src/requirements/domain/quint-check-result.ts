import type { ErrorMessage, VerificationMethod } from "@deep-spec/kernel-domain";
import type { QuintMachinePlan } from "./quint-machine-plan.ts";
import type { QuintRuns } from "./quint-runs.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { VerificationReport } from "./verification-report.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";
import type { VerificationSkips } from "./verification-skips.ts";

type QuintCheckResultParam =
  | { readonly kind: "cli-unavailable" }
  | { readonly kind: "machine-uncompilable"; readonly method: VerificationMethod; readonly error: ErrorMessage }
  | {
      readonly kind: "checked";
      readonly method: VerificationMethod;
      readonly plan: QuintMachinePlan;
      readonly compileSkips: VerificationSkips;
      readonly runs: QuintRuns;
    };

// Backendが収集した事実を解釈し、各状態に対応する一貫した検証文書を形成する。
export class QuintCheckResult {
  readonly #result: QuintCheckResultParam;

  private constructor(result: QuintCheckResultParam) {
    this.#result = { ...result };
  }

  static of(result: QuintCheckResultParam): QuintCheckResult {
    return new QuintCheckResult(result);
  }

  reportFor(model: RequirementsModel, id: VerificationReportIdentifier): VerificationReport {
    const result = this.#result;
    switch (result.kind) {
      case "cli-unavailable":
        return VerificationReport.quintUnavailable(id, model);
      case "machine-uncompilable":
        return VerificationReport.machineUncompilable(id, model, result.method.asString(), result.error.asString());
      case "checked": {
        const interpreted = result.plan.interpret(model, result.compileSkips, result.method.asString(), result.runs);
        return VerificationReport.compose({
          id,
          irVersion: model.irVersion(),
          irHash: model.irHash(),
          method: result.method.asString(),
          findings: interpreted.findings,
          skipped: interpreted.skipped,
        });
      }
    }
  }

  match<T>(cases: { unavailable: () => T; uncompilable: () => T; checked: () => T }): T {
    switch (this.#result.kind) {
      case "cli-unavailable":
        return cases.unavailable();
      case "machine-uncompilable":
        return cases.uncompilable();
      case "checked":
        return cases.checked();
    }
  }
}
