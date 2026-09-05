import { type ErrorMessage, SkipReason, UnitName } from "@deep-spec/kernel-domain";
import { DesignFindings } from "./design-findings.ts";
import type { DesignModel } from "./design-model.ts";
import type { DesignReport } from "./design-report.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweredUnit } from "./lowered-unit.ts";
import type { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
import type { SiblingVerdictDocument } from "./sibling-verdict-document.ts";

type SiblingVerificationState =
  | { kind: "backend-unavailable"; reason: ErrorMessage; refinementFailure: ErrorMessage }
  | { kind: "incomplete"; reason: ErrorMessage; refinementFailure: ErrorMessage }
  | { kind: "completed"; document: SiblingVerdictDocument; refinementFailure: ErrorMessage | null };

// プロセスの終了コードはadapterで解釈済み。設計検証としての意味だけを運ぶ。
export class SiblingVerificationResult {
  readonly #state: SiblingVerificationState;

  private constructor(state: SiblingVerificationState) {
    this.#state = state;
  }

  static backendUnavailable(reason: ErrorMessage, refinementFailure: ErrorMessage): SiblingVerificationResult {
    return new SiblingVerificationResult({ kind: "backend-unavailable", reason, refinementFailure });
  }

  static incomplete(reason: ErrorMessage, refinementFailure: ErrorMessage): SiblingVerificationResult {
    return new SiblingVerificationResult({ kind: "incomplete", reason, refinementFailure });
  }

  static completed(
    document: SiblingVerdictDocument,
    refinementFailure: ErrorMessage | null,
  ): SiblingVerificationResult {
    return new SiblingVerificationResult({ kind: "completed", document, refinementFailure });
  }

  isBackendUnavailable(): boolean {
    return this.#state.kind === "backend-unavailable";
  }

  canInspectReachability(): boolean {
    return this.#state.kind === "completed" && this.#state.document.isReadable();
  }

  recordedIn(report: DesignReport, model: DesignModel, unit: DesignUnit, lowered: LoweredUnit): DesignReport {
    const state = this.#state;
    if (state.kind === "backend-unavailable") return report.backendFailed(model, state.reason.asString());
    if (state.kind === "incomplete")
      return report.unitUnverified(unit, SkipReason.unavailable(), state.reason.asString());
    const mapped = state.document.remapVerdicts(unit, lowered.index());
    return mapped.unavailable === null
      ? report.unitVerified(unit, mapped.findings, mapped.skipped, mapped.method)
      : report.unitUnverified(unit, SkipReason.unavailable(), mapped.unavailable);
  }

  interpretRefinement(
    unit: DesignUnit,
    lowered: LoweredUnit,
    invariants: RefinementQuintInvariants,
  ): { findings: DesignFindings; skipped: DesignSkips } {
    const state = this.#state;
    let failure: string | null = state.refinementFailure?.asString() ?? null;
    if (state.kind === "completed" && failure === null) {
      const mapped = state.document.remapVerdicts(unit, lowered.index());
      if (mapped.unavailable === null) return invariants.interpret(mapped.findings, mapped.skipped, unit.name());
      failure = `refinement pass degraded: ${mapped.unavailable}`;
    }
    return {
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of(
        [...invariants].map((invariant) =>
          DesignSkipped.of({
            target: invariant.reqTarget(),
            unit: UnitName.of(unit.name()),
            reason: SkipReason.unavailable(),
            detail: failure ?? undefined,
          }),
        ),
      ),
    };
  }
}
