import {
  type Expression,
  ExpressionTree,
  FindingKind,
  FindingTargets,
  type FunctionalRequirementReferences,
  type ScenarioBindings,
  type ScenarioComparison,
  type ScenarioExpectation,
  SkipReason,
  TargetIdentifiers,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { QuintMachineComponents } from "./quint-machine-components.ts";
import type { QuintScenarioVerdict } from "./quint-scenario-verdict.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdict } from "./satisfiability-modulo-theories-query-verdict.ts";
import { TraceState } from "./trace-state.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { VerificationWitness } from "./verification-witness.ts";
// 受け入れ／拒否シナリオ。期待する充足可能性と binding の正準列挙を所有する。

import type { ScenarioIdentifier } from "./scenario-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ScenarioParam = {
  id: ScenarioIdentifier;
  expectation: ScenarioExpectation;
  functionalRequirementReferences: FunctionalRequirementReferences;
  bindings: ScenarioBindings;
  event?: { readonly trigger: TriggerName };
  expect?: Expression;
};

export class Scenario {
  readonly #id: ScenarioIdentifier;
  readonly #expectation: ScenarioExpectation;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #bindings: ScenarioBindings;
  readonly #eventTrigger: TriggerName | undefined;
  readonly #expect: Expression | undefined;

  private constructor(props: ScenarioParam) {
    this.#id = props.id;
    this.#expectation = props.expectation;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }

  static parse(props: ScenarioParam): Result<Scenario, ParseError> {
    return parseConstruction(() => new Scenario(props));
  }

  static of(props: ScenarioParam): Scenario {
    return new Scenario(props);
  }

  crossCheckFinding(comparison: ScenarioComparison): VerificationFinding | null {
    if (!comparison.isFor(this.#id.asTargetId(), null))
      throw new IllegalArgumentException({ kind: "different-cross-check-subject" });
    if (!comparison.disagrees()) return null;
    return VerificationFinding.of({
      kind: FindingKind.crossCheckDisagreement(),
      functionalRequirementReferences: this.#functionalRequirementReferences.sortedUnique(),
      targets: FindingTargets.of(this.#id.asTargetId(), []),
      witness: VerificationWitness.verdicts(comparison.toVerdictTable()),
      detail: `${comparison.description()} disagree on scenario ${this.#id.asString()}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`,
    });
  }

  id(): ScenarioIdentifier {
    return this.#id;
  }

  equals(other: Scenario): boolean {
    const expressionEqual = (left: Expression | undefined, right: Expression | undefined): boolean =>
      left === undefined
        ? right === undefined
        : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    const refs = this.#functionalRequirementReferences.toArray();
    const otherRefs = other.#functionalRequirementReferences.toArray();
    const bindings = [...this.#bindings];
    const otherBindings = [...other.#bindings];
    return (
      this.#id.equals(other.#id) &&
      this.#expectation.asString() === other.#expectation.asString() &&
      refs.length === otherRefs.length &&
      refs.every((ref, index) => ref.equals(otherRefs[index] as (typeof refs)[number])) &&
      bindings.length === otherBindings.length &&
      bindings.every((binding, index) => binding.equals(otherBindings[index] as (typeof bindings)[number])) &&
      (this.#eventTrigger === undefined
        ? other.#eventTrigger === undefined
        : other.#eventTrigger !== undefined && this.#eventTrigger.equals(other.#eventTrigger)) &&
      expressionEqual(this.#expect, other.#expect)
    );
  }
  kind(): "accept" | "reject" {
    return this.#expectation.asString();
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  eventTrigger(): TriggerName | undefined {
    return this.#eventTrigger;
  }
  expectedExpression(): Expression | undefined {
    return this.#expect;
  }
  isAccept(): boolean {
    return this.#expectation.isAccept();
  }
  isReject(): boolean {
    return this.#expectation.isReject();
  }
  hasEventRule(): boolean {
    return this.#eventTrigger !== undefined;
  }

  isViolatedBySatisfiability(satisfiable: boolean): boolean {
    return this.#expectation.isViolatedBySatisfiability(satisfiable);
  }

  interpretQuint(
    model: RequirementsModel,
    verdict: QuintScenarioVerdict | undefined,
    hasInitialState: boolean,
    components: QuintMachineComponents,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const target = this.#id.asTargetId();
    let skip: VerificationSkipped | null = null;
    if (this.hasEventRule())
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail: "scenarios with a When-event are not checked by the quint backend in v1",
      });
    else if (!hasInitialState)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail: "quint scenario evaluation requires bindings for every declared attribute",
      });
    else if (verdict === undefined)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.unavailable(),
        detail: "quint returned no run for this scenario",
      });
    else skip = verdict.skipFor(target);
    if (skip !== null) return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([skip]) });
    if (verdict === undefined || !this.isViolatedBySatisfiability(!verdict.isViolated()))
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const accept = this.isAccept();
    const violated = accept
      ? components.violatedBy(TraceState.fromBindings(this.#bindings)).ids().toTargetIds()
      : TargetIdentifiers.of([]);
    const parsedTargets = FindingTargets.parse(target, [...violated]);
    if (!parsedTargets.ok) return parsedTargets;
    const targets = parsedTargets.value.sortedUniqueCanonically();
    return ok({
      findings: VerificationFindings.of([
        VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
          targets,
          witness: VerificationWitness.model(this.#bindings.toDocument()),
          detail: accept
            ? `Accept scenario ${this.#id.asString()} describes a state the obligations rule out — the requirements reject an example that should be accepted.`
            : `Reject scenario ${this.#id.asString()} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        }),
      ]),
      skipped: VerificationSkips.of([]),
    });
  }

  interpretSatisfiability(
    model: RequirementsModel,
    verdict: SatisfiabilityModuloTheoriesQueryVerdict,
    coreTargets: TargetIdentifiers,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    const target = this.#id.asTargetId();
    if (verdict.isUndecided())
      return ok({
        findings: VerificationFindings.of([]),
        skipped: verdict.skipsFor(TargetIdentifiers.of([target]), `scenario check for ${this.#id.asString()}`),
      });
    if (!this.isViolatedBySatisfiability(verdict.isSat()))
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const accept = this.isAccept();
    const parsedTargets = FindingTargets.parse(target, accept ? [...coreTargets] : []);
    if (!parsedTargets.ok) return parsedTargets;
    const targets = accept ? parsedTargets.value.sortedUniqueCanonically() : parsedTargets.value;
    const finding = VerificationFinding.of({
      kind: FindingKind.scenarioViolation(),
      functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
      targets,
      witness: accept
        ? VerificationWitness.core(verdict.sortedCore())
        : VerificationWitness.model(verdict.witnessModel()),
      detail: accept
        ? `Accept scenario ${this.#id.asString()} describes a state the obligations in the witness core rule out — the requirements reject an example that should be accepted.`
        : `Reject scenario ${this.#id.asString()} is still satisfiable — the requirements do not exclude an example that should be rejected (witness state attached).`,
    });
    return ok({ findings: VerificationFindings.of([finding]), skipped: VerificationSkips.of([]) });
  }

  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
