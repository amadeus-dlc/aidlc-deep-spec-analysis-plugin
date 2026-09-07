import {
  FindingKind,
  FindingTargets,
  type QueryLabel,
  TargetIdentifiers,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import { combinedHash, ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { ObligationIdentifier } from "./obligation-identifier.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 同トリガのイベント対 (a, b) に発行した 2 問——ガードの重なり（overlap）と
// 効果の両立（joint）。計画の解釈は対自身に判定を引かせ、対象を問う
// （#71 波25）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SatisfiabilityModuloTheoriesEventPairProbeParam = {
  qOverlap: QueryLabel;
  qJoint: QueryLabel;
  a: ObligationIdentifier;
  b: ObligationIdentifier;
  trigger: TriggerName;
};

export class SatisfiabilityModuloTheoriesEventPairProbe {
  readonly #qOverlap: QueryLabel;
  readonly #qJoint: QueryLabel;
  readonly #a: ObligationIdentifier;
  readonly #b: ObligationIdentifier;
  readonly #trigger: TriggerName;

  private constructor(props: SatisfiabilityModuloTheoriesEventPairProbeParam) {
    this.#qOverlap = props.qOverlap;
    this.#qJoint = props.qJoint;
    this.#a = props.a;
    this.#b = props.b;
    this.#trigger = props.trigger;
  }

  static of(props: SatisfiabilityModuloTheoriesEventPairProbeParam): SatisfiabilityModuloTheoriesEventPairProbe {
    return new SatisfiabilityModuloTheoriesEventPairProbe(props);
  }

  interpret(
    model: RequirementsModel,
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const overlap = this.#overlapVerdictIn(results);
    const joint = this.#jointVerdictIn(results);
    if (overlap.isSat() && joint.isUnsat()) {
      const targets = FindingTargets.of(this.#a.asTargetId(), [this.#b.asTargetId()]).sortedUniqueCanonically();
      return ok({
        findings: VerificationFindings.of([
          VerificationFinding.of({
            kind: FindingKind.conflict(),
            functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
            targets,
            witness: VerificationWitness.core(joint.sortedCore()),
            detail: `Events ${this.#a.asString()} and ${this.#b.asString()} for trigger "${this.#trigger.asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`,
          }),
        ]),
        skipped: VerificationSkips.of([]),
      });
    }
    const pending =
      [overlap, joint].find((verdict) => verdict.isMissing()) ?? (overlap.isUndecided() ? overlap : joint);
    return ok({
      findings: VerificationFindings.of([]),
      skipped:
        overlap.isUndecided() || joint.isUndecided()
          ? pending.skipsFor(this.targets(), `event-pair check for trigger "${this.#trigger.asString()}"`)
          : VerificationSkips.of([]),
    });
  }

  // 対の 2 対象（発行順）。
  targets(): TargetIdentifiers {
    return TargetIdentifiers.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }

  equals(other: SatisfiabilityModuloTheoriesEventPairProbe): boolean {
    return (
      this.#qOverlap.equals(other.#qOverlap) &&
      this.#qJoint.equals(other.#qJoint) &&
      this.#a.equals(other.#a) &&
      this.#b.equals(other.#b) &&
      this.#trigger.equals(other.#trigger)
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#qOverlap.hashCode(),
      this.#qJoint.hashCode(),
      this.#a.hashCode(),
      this.#b.hashCode(),
      this.#trigger.hashCode(),
    ]);
  }

  #overlapVerdictIn(
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): ReturnType<SatisfiabilityModuloTheoriesQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qOverlap);
  }

  #jointVerdictIn(
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): ReturnType<SatisfiabilityModuloTheoriesQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qJoint);
  }
}
