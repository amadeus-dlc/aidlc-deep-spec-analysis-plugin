import { TargetIdentifiers, type TriggerName, QueryLabel } from "@deep-spec/kernel-domain";
import type { ObligationIdentifier } from "./obligation-identifier.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";

// 同トリガのイベント対 (a, b) に発行した 2 問——ガードの重なり（overlap）と
// 効果の両立（joint）。計画の解釈は対自身に判定を引かせ、対象を問う
// （#71 波25）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type SatisfiabilityModuloTheoriesEventPairProbeParam = { qOverlap: QueryLabel; qJoint: QueryLabel; a: ObligationIdentifier; b: ObligationIdentifier; trigger: TriggerName };

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

  a(): ObligationIdentifier {
    return this.#a;
  }

  b(): ObligationIdentifier {
    return this.#b;
  }

  trigger(): TriggerName {
    return this.#trigger;
  }

  // 対の 2 対象（発行順）。
  targets(): TargetIdentifiers {
    return TargetIdentifiers.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }

  overlapVerdictIn(results: SatisfiabilityModuloTheoriesQueryVerdicts): ReturnType<SatisfiabilityModuloTheoriesQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qOverlap);
  }

  jointVerdictIn(results: SatisfiabilityModuloTheoriesQueryVerdicts): ReturnType<SatisfiabilityModuloTheoriesQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qJoint);
  }
}
