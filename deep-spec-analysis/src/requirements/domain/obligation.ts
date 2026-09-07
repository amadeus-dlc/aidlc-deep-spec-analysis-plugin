import {
  type Expression,
  ExpressionTree,
  FindingKind,
  FindingTargets,
  type FunctionalRequirementReferences,
  type ObligationNature,
  SkipReason,
  type TriggerName,
  type VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  combinedHash,
  hashOfNullable,
  hashOfString,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { QuintTemporalVerdict } from "./quint-temporal-verdict.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";
// 義務（EARS nature 付き）。分類・event 完全性・式の役割は義務自身が所有し、
// コンパイラは外部形式への射影だけを担う。

import type { ObligationIdentifier } from "./obligation-identifier.ts";

type TemporalExpressions = {
  readonly pattern: string;
  readonly assert?: Expression;
  readonly from?: Expression;
  readonly to?: Expression;
};

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ObligationParam = {
  id: ObligationIdentifier;
  nature: ObligationNature;
  functionalRequirementReferences: FunctionalRequirementReferences;
  ears?: string;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
  temporal?: TemporalExpressions;
};

export class Obligation {
  readonly #id: ObligationIdentifier;
  readonly #nature: ObligationNature;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #ears: string | undefined;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: TemporalExpressions | undefined;

  private constructor(props: ObligationParam) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#ears = props.ears;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal =
      props.temporal === undefined
        ? undefined
        : {
            ...props.temporal,
            ...(props.temporal.assert !== undefined
              ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() }
              : {}),
            ...(props.temporal.from !== undefined
              ? { from: ExpressionTree.of(props.temporal.from).asExpression() }
              : {}),
            ...(props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}),
          };
  }

  static parse(props: ObligationParam): Result<Obligation, ParseError> {
    return parseConstruction(() => new Obligation(props));
  }

  static of(props: ObligationParam): Obligation {
    return new Obligation(props);
  }

  interpretQuintTemporal(
    method: VerificationMethod,
    verdict: QuintTemporalVerdict | undefined,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    if (!this.isStateTemporal() || this.#temporal?.pattern !== "leads-to")
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const target = this.#id.asTargetId();
    let skip: VerificationSkipped | null = null;
    if (!method.isBounded())
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail:
          "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
      });
    else if (verdict === undefined)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.unavailable(),
        detail: "quint returned no run for this temporal obligation",
      });
    else skip = verdict.skipFor(target);
    if (skip !== null) return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([skip]) });
    const finding = verdict?.isViolation()
      ? VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: this.#functionalRequirementReferences.sortedUnique(),
          targets: FindingTargets.of(target, []),
          witness: verdict.witness(),
          detail: `Temporal obligation ${this.#id.asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
        })
      : null;
    return ok({
      findings: VerificationFindings.of(finding === null ? [] : [finding]),
      skipped: VerificationSkips.of([]),
    });
  }

  id(): ObligationIdentifier {
    return this.#id;
  }

  equals(other: Obligation): boolean {
    const expressionEqual = (left: Expression | undefined, right: Expression | undefined): boolean =>
      left === undefined
        ? right === undefined
        : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    const temporalEqual = (left: TemporalExpressions | undefined, right: TemporalExpressions | undefined): boolean => {
      if (left === undefined || right === undefined) return left === right;
      return (
        left.pattern === right.pattern &&
        expressionEqual(left.assert, right.assert) &&
        expressionEqual(left.from, right.from) &&
        expressionEqual(left.to, right.to)
      );
    };
    return (
      this.#id.equals(other.#id) &&
      this.#nature.equals(other.#nature) &&
      this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences) &&
      this.#ears === other.#ears &&
      expressionEqual(this.#assert, other.#assert) &&
      (this.#trigger === undefined
        ? other.#trigger === undefined
        : other.#trigger !== undefined && this.#trigger.equals(other.#trigger)) &&
      expressionEqual(this.#guard, other.#guard) &&
      expressionEqual(this.#effect, other.#effect) &&
      temporalEqual(this.#temporal, other.#temporal)
    );
  }

  hashCode(): number {
    const expressionHash = (expression: Expression | undefined): number =>
      hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    const temporalHash = hashOfNullable(this.#temporal, (temporal) =>
      combinedHash([
        hashOfString(temporal.pattern),
        expressionHash(temporal.assert),
        expressionHash(temporal.from),
        expressionHash(temporal.to),
      ]),
    );
    return combinedHash([
      this.#id.hashCode(),
      this.#nature.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      hashOfNullable(this.#ears, hashOfString),
      expressionHash(this.#assert),
      hashOfNullable(this.#trigger, (trigger) => trigger.hashCode()),
      expressionHash(this.#guard),
      expressionHash(this.#effect),
      temporalHash,
    ]);
  }
  nature(): ObligationNature {
    return this.#nature;
  }
  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }
  ears(): string | undefined {
    return this.#ears;
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
  temporal(): TemporalExpressions | undefined {
    return this.#temporal === undefined ? undefined : { ...this.#temporal };
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
    if (!this.isEvent() || this.#trigger === undefined || this.#guard === undefined || this.#effect === undefined)
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }

  vacuityAntecedent(): Expression | undefined {
    return this.#assert?.op === "implies" ? this.#assert.args?.[0] : undefined;
  }

  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#guard !== undefined) visitor(this.#guard, false);
    if (this.#effect !== undefined) visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined) visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined) visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined) visitor(this.#temporal.to, false);
  }
}
