import { TargetIds, type TriggerName } from "../../kernel/domain/index.ts";
import type { ObligationId } from "./obligation-id.ts";
import type { SmtQueryVerdicts } from "./smt-query-verdicts.ts";

// 同トリガのイベント対 (a, b) に発行した 2 問——ガードの重なり（overlap）と
// 効果の両立（joint）。事実の解釈は対自身に判定を引かせ、対象を問う
// （#71 波25）。
export class SmtEventPairProbe {
  readonly #qOverlap: string;
  readonly #qJoint: string;
  readonly #a: ObligationId;
  readonly #b: ObligationId;
  readonly #trigger: TriggerName;

  private constructor(props: { qOverlap: string; qJoint: string; a: ObligationId; b: ObligationId; trigger: TriggerName }) {
    this.#qOverlap = props.qOverlap;
    this.#qJoint = props.qJoint;
    this.#a = props.a;
    this.#b = props.b;
    this.#trigger = props.trigger;
  }

  static of(props: { qOverlap: string; qJoint: string; a: ObligationId; b: ObligationId; trigger: TriggerName }): SmtEventPairProbe {
    return new SmtEventPairProbe(props);
  }

  a(): ObligationId {
    return this.#a;
  }

  b(): ObligationId {
    return this.#b;
  }

  trigger(): TriggerName {
    return this.#trigger;
  }

  // 対の 2 対象（発行順）。
  targets(): TargetIds {
    return TargetIds.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }

  overlapVerdictIn(results: SmtQueryVerdicts): ReturnType<SmtQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qOverlap);
  }

  jointVerdictIn(results: SmtQueryVerdicts): ReturnType<SmtQueryVerdicts["verdictOf"]> {
    return results.verdictOf(this.#qJoint);
  }
}
