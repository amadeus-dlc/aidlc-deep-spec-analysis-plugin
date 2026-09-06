import {
  AttributePath,
  type Expression,
  ExpressionTree,
  FunctionalRequirementReferences,
  KeyedIndex,
  ObligationNature,
  type TriggerName,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignAssignments } from "./design-assignments.ts";
import type { DesignObligationIdentifier } from "./design-obligation-identifier.ts";
import type { DesignTransitionIdentifier } from "./design-transition-identifier.ts";
import { EffectAssignments } from "./effect-assignments.ts";
import type { LoweredIdentifier } from "./lowered-identifier.ts";
import { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";

type DesignEventRuleParam = {
  reference: DesignObligationIdentifier | DesignTransitionIdentifier;
  trigger: TriggerName;
  guard: Expression;
} & ({ effect: Expression; implicitEffect?: Expression } | { effect?: Expression; implicitEffect: Expression });

export class DesignEventRule {
  readonly #reference: DesignObligationIdentifier | DesignTransitionIdentifier;
  readonly #trigger: TriggerName;
  readonly #guard: ExpressionTree;
  readonly #effect: ExpressionTree;
  readonly #assignments: DesignAssignments | null;

  private constructor(props: DesignEventRuleParam) {
    const effect =
      props.implicitEffect === undefined
        ? props.effect
        : props.effect === undefined
          ? props.implicitEffect
          : { op: "and", args: [props.implicitEffect, props.effect] };
    if (effect === undefined) throw new IllegalArgumentException({ kind: "event-effect-missing" });
    this.#reference = props.reference;
    this.#trigger = props.trigger;
    this.#guard = ExpressionTree.of(props.guard);
    this.#effect = ExpressionTree.of(effect);
    const terms: (readonly [AttributePath, Expression])[] = [];
    let interpretable = false;
    for (const part of [props.implicitEffect, props.effect]) {
      if (part === undefined) continue;
      const parsed = EffectAssignments.parse(part);
      if (!parsed.ok) continue;
      interpretable = true;
      for (const [path, term] of parsed.value) {
        const [a, b] = term.args ?? [];
        const rhs = a?.op === "ref" && a.prime === true ? b : a;
        if (rhs !== undefined) terms.push([path, rhs]);
      }
    }
    this.#assignments = interpretable ? DesignAssignments.of(KeyedIndex.of(terms)) : null;
  }
  static of(props: DesignEventRuleParam): DesignEventRule {
    return new DesignEventRule(props);
  }
  static parse(props: DesignEventRuleParam): Result<DesignEventRule, ParseError> {
    return parseConstruction(() => new DesignEventRule(props));
  }
  trigger(): TriggerName {
    return this.#trigger;
  }
  reference(): LoweredOriginReference {
    return LoweredOriginReference.of(this.#reference.asString());
  }
  guard(): Expression {
    return this.#guard.asExpression();
  }
  sameRuleAs(other: DesignEventRule): boolean {
    return this.#reference.asString() === other.#reference.asString();
  }
  sameTriggerAs(other: DesignEventRule): boolean {
    return this.#trigger.equals(other.#trigger);
  }
  sameEffectAs(other: DesignEventRule): boolean {
    return this.#effect.isCanonicallyEqual(other.#effect);
  }
  hasAssignments(): boolean {
    return this.#assignments !== null;
  }
  assignedRhsOf(path: string): Expression | undefined {
    return this.#assignments?.rhsOf(AttributePath.of(path));
  }
  deadGuardProbe(id: LoweredIdentifier): Result<LoweredObligation, ParseError> {
    return LoweredObligation.parse({
      id,
      origin: LoweredOrigin.of({ kind: "vac-dead", design: this.reference() }),
      nature: ObligationNature.of("invariant"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      assert: { op: "implies", args: [this.guard(), { op: "bool", value: true }] },
    });
  }
}
