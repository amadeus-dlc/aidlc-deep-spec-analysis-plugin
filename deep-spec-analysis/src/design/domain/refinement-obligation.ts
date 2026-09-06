import type { Expression, FunctionalRequirementReferences, TriggerName } from "@deep-spec-analysis/kernel-domain";
import { AttributePath, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  ok,
  type ParseError,
  parseConstruction,
  type Result,
  traverseResult,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ObligationIdentifier, ObligationNature } from "@deep-spec-analysis/requirements-domain";
import type { AttributeCoverage } from "./attribute-coverage.ts";
import { AttributePaths } from "./attribute-paths.ts";
import type { DesignUnit } from "./design-unit.ts";
import { RefinementStatus } from "./refinement-status.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";
import { TransitionReferences } from "./transition-references.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RefinementObligationParam = {
  id: ObligationIdentifier;
  nature: ObligationNature;
  functionalRequirementReferences: FunctionalRequirementReferences;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
};

export class RefinementObligation {
  readonly #id: ObligationIdentifier;
  readonly #nature: ObligationNature;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;

  private constructor(props: RefinementObligationParam) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }

  static parse(props: RefinementObligationParam): Result<RefinementObligation, ParseError> {
    return parseConstruction(() => new RefinementObligation(props));
  }

  static of(props: RefinementObligationParam): RefinementObligation {
    return new RefinementObligation(props);
  }

  #coverage(
    expressions: readonly (Expression | undefined)[],
    map: RefinementUnitMap,
  ): Result<AttributeCoverage, ParseError> {
    const paths: AttributePath[] = [];
    for (const expression of expressions) {
      if (expression === undefined) continue;
      const parsed = traverseResult(ExpressionTree.of(expression).referencedPaths(), AttributePath.parse);
      if (!parsed.ok) return parsed;
      paths.push(...parsed.value);
    }
    return ok(map.attrMap().coverageOf(AttributePaths.of(paths), map.unmapped()));
  }

  coverageIn(map: RefinementUnitMap, unit: DesignUnit): RefinementStatus {
    if (map.unmapped().covers(this.#id))
      return RefinementStatus.waived(map.unmapped().reasonOf(this.#id) ?? "listed in unmapped[]");
    if (this.isStateTemporal()) return RefinementStatus.capability("temporal refinement is outside v1 scope");
    if (this.isInvariantLike()) {
      const coverage = this.#coverage([this.#assert], map);
      return coverage.ok
        ? coverage.value.forInvariant()
        : RefinementStatus.gap(`invalid attribute reference: ${coverage.error.kind}`);
    }
    if (this.isEvent()) {
      const entry = this.#trigger === undefined ? undefined : map.eventMappingOf(this.#trigger);
      if (entry === undefined)
        return RefinementStatus.gap(
          `requirements event trigger "${this.#trigger?.asString() ?? "?"}" has no eventMap entry (map it to design transitions or waive it)`,
        );
      const eligibility = entry.statusIn(unit);
      if (!eligibility.isCheckable()) return eligibility;
      const coverage = this.#coverage([this.#guard, this.#effect], map);
      return coverage.ok
        ? coverage.value.forEvent()
        : RefinementStatus.gap(`invalid attribute reference: ${coverage.error.kind}`);
    }
    return RefinementStatus.capability(`nature "${this.#nature.asString()}" has no refinement check`);
  }

  mappedTransitionsIn(map: RefinementUnitMap): TransitionReferences {
    return this.#trigger === undefined
      ? TransitionReferences.of([])
      : (map.eventMappingOf(this.#trigger)?.transitions() ?? TransitionReferences.of([]));
  }

  id(): ObligationIdentifier {
    return this.#id;
  }
  nature(): ObligationNature {
    return this.#nature;
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  assertion(): Expression | undefined {
    return this.#assert;
  }
  trigger(): TriggerName | undefined {
    return this.#trigger;
  }
  guard(): Expression | undefined {
    return this.#guard;
  }
  effect(): Expression | undefined {
    return this.#effect;
  }
  isInvariantLike(): boolean {
    return this.#nature.isInvariant() || this.#nature.isNumeric();
  }
  isEvent(): boolean {
    return this.#nature.isEvent();
  }
  isStateTemporal(): boolean {
    return this.#nature.isStateTemporal();
  }

  eventDefinition(): { readonly trigger: TriggerName; readonly guard: Expression; readonly effect: Expression } | null {
    if (
      !this.#nature.isEvent() ||
      this.#trigger === undefined ||
      this.#guard === undefined ||
      this.#effect === undefined
    )
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
}
