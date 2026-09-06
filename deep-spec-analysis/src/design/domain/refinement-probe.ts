import {
  FindingKind,
  type FindingKind as FindingKindType,
  type QueryLabel,
  SkipReason,
  type TargetIdentifier,
  TargetIdentifiers,
  type UnitName,
} from "@deep-spec-analysis/kernel-domain";
import { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import { DesignWitness } from "./design-witness.ts";
import type { RefinementObligation } from "./refinement-obligation.ts";
import type { RefinementQueryVerdict } from "./refinement-query-verdict.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import type { RefinementScenario } from "./refinement-scenario.ts";
import type { TransitionReference } from "./transition-reference.ts";
import type { TransitionReferences } from "./transition-references.ts";

type RefinementProbeParam = { unit: UnitName } & (
  | { kind: "invariant"; subject: RefinementObligation }
  | { kind: "enabledness"; subject: RefinementObligation; transitions: TransitionReferences }
  | { kind: "simulation"; subject: RefinementObligation; designId: TransitionReference }
  | { kind: "scenario"; subject: RefinementScenario }
);
export class RefinementProbe {
  readonly #state: RefinementProbeParam;
  private constructor(state: RefinementProbeParam) {
    this.#state = { ...state };
  }
  static invariant(subject: RefinementObligation, unit: UnitName): RefinementProbe {
    return new RefinementProbe({ kind: "invariant", subject, unit });
  }
  static enabledness(
    subject: RefinementObligation,
    unit: UnitName,
    transitions: TransitionReferences,
  ): RefinementProbe {
    return new RefinementProbe({ kind: "enabledness", subject, unit, transitions });
  }
  static simulation(subject: RefinementObligation, unit: UnitName, designId: TransitionReference): RefinementProbe {
    return new RefinementProbe({ kind: "simulation", subject, unit, designId });
  }
  static scenario(subject: RefinementScenario, unit: UnitName): RefinementProbe {
    return new RefinementProbe({ kind: "scenario", subject, unit });
  }
  reqTarget(): TargetIdentifier {
    return this.#state.subject.id().asTargetId();
  }
  belongsToRequirements(requirements: RefinementRequirements): boolean {
    const subject = this.#state.subject;
    return this.#state.kind === "scenario"
      ? requirements.scenarioById(subject.id().asString()) === subject
      : requirements.obligationById(subject.id().asString()) === subject;
  }
  belongsTo(unit: UnitName): boolean {
    return this.#state.unit.equals(unit);
  }
  #finding(kind: FindingKindType, targets: TargetIdentifiers, witness: DesignWitness, detail: string): DesignFinding {
    return DesignFinding.of({
      kind,
      targets,
      witness,
      detail,
      unit: this.#state.unit,
      functionalRequirementReferences: this.#state.subject.functionalRequirementReferences().sortedUnique(),
    });
  }
  interpret(
    query: QueryLabel,
    verdict: RefinementQueryVerdict | undefined,
  ): { findings: DesignFindings; skipped: DesignSkips } {
    if (verdict === undefined || verdict.isUndecided())
      return {
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([
          DesignSkipped.of({
            target: this.reqTarget(),
            reason: SkipReason.timeout(),
            unit: this.#state.unit,
            detail: `refinement query ${query.asString()} exceeded the solver budget or errored`,
          }),
        ]),
      };
    const finding = this.#decidedFinding(verdict);
    return { findings: DesignFindings.of(finding === null ? [] : [finding]), skipped: DesignSkips.of([]) };
  }
  #decidedFinding(verdict: RefinementQueryVerdict): DesignFinding | null {
    const state = this.#state;
    const unit = state.unit.asString();
    const target = this.reqTarget();
    const id = target.asString();
    const targets = TargetIdentifiers.of([target]);
    if (state.kind === "scenario") {
      if (!state.subject.isViolatedBySatisfiability(verdict.isSat())) return null;
      return state.subject.isAccept()
        ? this.#finding(
            FindingKind.refinementViolation(),
            targets,
            DesignWitness.core(verdict.sortedCore()),
            `Accept scenario ${id} has no design-legal counterpart in unit ${unit} under the refinement map: the design excludes an example the requirements accept (witness core attached).`,
          )
        : this.#finding(
            FindingKind.refinementViolation(),
            targets,
            DesignWitness.model(verdict.witnessModel()),
            `Reject scenario ${id} is still admitted by unit ${unit} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`,
          );
    }
    if (!verdict.isSat()) return null;
    switch (state.kind) {
      case "invariant":
        return this.#finding(
          FindingKind.refinementViolation(),
          targets,
          DesignWitness.model(verdict.witnessModel()),
          `A design-legal state of unit ${unit} violates requirements obligation ${id} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`,
        );
      case "enabledness":
        return this.#finding(
          FindingKind.completenessGap(),
          TargetIdentifiers.of([
            target,
            ...[...state.transitions].map((reference) => reference.asTargetId()),
          ]).sortedUniqueCanonically(),
          DesignWitness.model(verdict.witnessModel()),
          `The requirements event ${id} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`,
        );
      case "simulation":
        return this.#finding(
          FindingKind.refinementViolation(),
          TargetIdentifiers.of([target, state.designId.asTargetId()]).sortedUniqueCanonically(),
          DesignWitness.trace(verdict.witnessTrace()),
          `Design step ${state.designId.asString()} of unit ${unit}, taken where requirements event ${id} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`,
        );
    }
  }
}
