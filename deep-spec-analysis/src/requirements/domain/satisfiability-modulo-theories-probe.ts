import {
  FindingKind,
  FindingTargets,
  type KeyedIndex,
  QueryLabel,
  type TargetIdentifier,
  TargetIdentifiers,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import { err, ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { ObligationIdentifier } from "./obligation-identifier.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import type { Scenario } from "./scenario.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { VerificationWitness } from "./verification-witness.ts";

type SatisfiabilityModuloTheoriesProbeParam =
  | { kind: "consistency"; fallback: TargetIdentifiers; labels: KeyedIndex<QueryLabel, TargetIdentifier> }
  | { kind: "vacuity"; subject: ObligationIdentifier; labels: KeyedIndex<QueryLabel, TargetIdentifier> }
  | { kind: "completeness"; trigger: TriggerName; targets: TargetIdentifiers }
  | { kind: "scenario"; subject: Scenario; labels: KeyedIndex<QueryLabel, TargetIdentifier> };

export class SatisfiabilityModuloTheoriesProbe {
  readonly #query: QueryLabel;
  readonly #subject: SatisfiabilityModuloTheoriesProbeParam;
  private constructor(query: QueryLabel, subject: SatisfiabilityModuloTheoriesProbeParam) {
    this.#query = query;
    this.#subject = { ...subject };
  }
  static consistency(
    fallback: TargetIdentifiers,
    labels: KeyedIndex<QueryLabel, TargetIdentifier>,
  ): SatisfiabilityModuloTheoriesProbe {
    return new SatisfiabilityModuloTheoriesProbe(QueryLabel.of("global"), { kind: "consistency", fallback, labels });
  }
  static vacuity(
    query: QueryLabel,
    subject: ObligationIdentifier,
    labels: KeyedIndex<QueryLabel, TargetIdentifier>,
  ): SatisfiabilityModuloTheoriesProbe {
    return new SatisfiabilityModuloTheoriesProbe(query, { kind: "vacuity", subject, labels });
  }
  static completeness(trigger: TriggerName, targets: TargetIdentifiers): SatisfiabilityModuloTheoriesProbe {
    return new SatisfiabilityModuloTheoriesProbe(QueryLabel.of(`gap:${trigger.asString()}`), {
      kind: "completeness",
      trigger,
      targets,
    });
  }
  static scenario(
    query: QueryLabel,
    subject: Scenario,
    labels: KeyedIndex<QueryLabel, TargetIdentifier>,
  ): SatisfiabilityModuloTheoriesProbe {
    return new SatisfiabilityModuloTheoriesProbe(query, { kind: "scenario", subject, labels });
  }
  allowsVacuityChecks(results: SatisfiabilityModuloTheoriesQueryVerdicts): boolean {
    return this.#subject.kind === "consistency" && !results.verdictOf(this.#query).isUnsat();
  }
  #coreTargets(labels: readonly QueryLabel[]): TargetIdentifiers {
    const state = this.#subject;
    if (state.kind === "completeness") return TargetIdentifiers.of([]);
    return TargetIdentifiers.of(
      labels
        .map((label) => state.labels.get(label))
        .filter((target): target is TargetIdentifier => target?.isRequirementObligation() ?? false),
    ).sortedUniqueCanonically();
  }
  interpret(
    model: RequirementsModel,
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const verdict = results.verdictOf(this.#query);
    const state = this.#subject;
    if (state.kind === "scenario")
      return state.subject.interpretSatisfiability(model, verdict, this.#coreTargets([...verdict.coreLabels()]));
    const targets =
      state.kind === "consistency"
        ? state.fallback
        : state.kind === "vacuity"
          ? TargetIdentifiers.of([state.subject.asTargetId()])
          : state.targets;
    const context =
      state.kind === "consistency"
        ? "global consistency check"
        : state.kind === "vacuity"
          ? `vacuity check for ${state.subject.asString()}`
          : `completeness check for trigger "${state.trigger.asString()}"`;
    if (verdict.isUndecided())
      return ok({
        findings: VerificationFindings.of([]),
        skipped: verdict.skipsFor(targets, context),
      });
    let finding: VerificationFinding | null = null;
    if (state.kind === "completeness" && verdict.isSat()) {
      const [head, ...tail] = targets;
      if (head === undefined) return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok) return parsedTargets;
      finding = VerificationFinding.of({
        kind: FindingKind.completenessGap(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
        targets: parsedTargets.value,
        witness: VerificationWitness.model(verdict.witnessModel()),
        detail: `No rule for trigger "${state.trigger.asString()}" applies to the witness state: the behavior of this input region is unspecified.`,
      });
    }
    if (state.kind !== "completeness" && verdict.isUnsat()) {
      const core = this.#coreTargets([...verdict.coreLabels()]);
      const effective =
        state.kind === "vacuity"
          ? core.add(state.subject.asTargetId()).sortedUniqueCanonically()
          : core.count() > 0
            ? core
            : state.fallback;
      const [head, ...tail] = effective;
      if (head === undefined) return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok) return parsedTargets;
      finding = VerificationFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(effective),
        targets: parsedTargets.value,
        witness: VerificationWitness.core(verdict.sortedCore()),
        detail:
          state.kind === "consistency"
            ? "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them."
            : `The condition of obligation ${state.subject.asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`,
      });
    }
    return ok({
      findings: VerificationFindings.of(finding === null ? [] : [finding]),
      skipped: VerificationSkips.of([]),
    });
  }
}
