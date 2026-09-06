import {
  type Expression,
  ExpressionTree,
  FindingKind,
  type FunctionalRequirementReferences,
  type ScenarioBindings,
  type ScenarioExpectation,
  SkipReason,
  TargetIdentifiers,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
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

  id(): ScenarioIdentifier {
    return this.#id;
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
  hasEvent(): boolean {
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
  ): { findings: VerificationFindings; skipped: VerificationSkips } {
    const target = this.#id.asTargetId();
    let skip: VerificationSkipped | null = null;
    if (this.hasEvent())
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
    if (skip !== null) return { findings: VerificationFindings.of([]), skipped: VerificationSkips.of([skip]) };
    if (verdict === undefined || !this.isViolatedBySatisfiability(!verdict.isViolated()))
      return { findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) };
    const accept = this.isAccept();
    const violated = accept
      ? components.violatedBy(TraceState.fromBindings(this.#bindings)).ids().toTargetIds()
      : TargetIdentifiers.of([]);
    const targets = TargetIdentifiers.of([target, ...violated]).sortedUniqueCanonically();
    return {
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
    };
  }

  interpretSatisfiability(
    model: RequirementsModel,
    verdict: SatisfiabilityModuloTheoriesQueryVerdict,
    coreTargets: TargetIdentifiers,
  ): { findings: VerificationFindings; skipped: VerificationSkips } {
    const target = this.#id.asTargetId();
    if (verdict.isUndecided())
      return {
        findings: VerificationFindings.of([]),
        skipped: verdict.skipsFor(TargetIdentifiers.of([target]), `scenario check for ${this.#id.asString()}`),
      };
    if (!this.isViolatedBySatisfiability(verdict.isSat()))
      return { findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) };
    const accept = this.isAccept();
    const targets = accept
      ? TargetIdentifiers.of([target, ...coreTargets]).sortedUniqueCanonically()
      : TargetIdentifiers.of([target]);
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
    return { findings: VerificationFindings.of([finding]), skipped: VerificationSkips.of([]) };
  }

  bindings(): ScenarioBindings {
    return this.#bindings;
  }
}
