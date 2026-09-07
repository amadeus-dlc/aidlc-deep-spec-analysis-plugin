import type { TriggerName } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNullable, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignUnit } from "./design-unit.ts";
import { RefinementStatus } from "./refinement-status.ts";
import type { TransitionReferences } from "./transition-references.ts";

// eventMap の 1 エントリ——要件トリガから設計 遷移/義務 id 群への写像。
// 免除（waived）された写像は理由を持ち、遷移を持たない。計画はトリガの
// 一致と免除を問い、遷移群を受け取る（#71 波24）。
export class EventMapping {
  readonly #reqTrigger: TriggerName;
  readonly #transitions: TransitionReferences;
  readonly #reason: string | null;

  private constructor(props: { reqTrigger: TriggerName; transitions: TransitionReferences; reason: string | null }) {
    this.#reqTrigger = props.reqTrigger;
    this.#transitions = props.transitions;
    this.#reason = props.reason;
  }

  static of(props: {
    reqTrigger: TriggerName;
    transitions: TransitionReferences;
    waived?: { reason: string };
  }): EventMapping {
    return new EventMapping({
      reqTrigger: props.reqTrigger,
      transitions: props.transitions,
      reason: props.waived?.reason ?? null,
    });
  }

  equals(other: EventMapping): boolean {
    return (
      this.#reqTrigger.equals(other.#reqTrigger) &&
      this.#reason === other.#reason &&
      this.#transitions.equals(other.#transitions)
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#reqTrigger.hashCode(),
      hashOfNullable(this.#reason, hashOfString),
      this.#transitions.hashCode(),
    ]);
  }

  statusIn(unit: DesignUnit): RefinementStatus {
    if (this.#reason !== null) return RefinementStatus.waived(this.#reason);
    if (this.#transitions.isEmpty())
      return RefinementStatus.gap(
        `requirements event trigger "${this.#reqTrigger.asString()}" has no eventMap entry (map it to design transitions or waive it)`,
      );
    const unknown = this.#transitions.unknownAmong(
      new Set([...unit.obligations().ids(), ...unit.machines().transitionIds()]),
    );
    return unknown.length > 0
      ? RefinementStatus.gap(
          `eventMap for "${this.#reqTrigger.asString()}" names unknown design id(s) ${unknown.join(", ")}`,
        )
      : RefinementStatus.checkable();
  }

  isForTrigger(reqTrigger: TriggerName): boolean {
    return this.#reqTrigger.equals(reqTrigger);
  }

  // 免除の理由。免除されていなければ null。
  waiverReason(): string | null {
    return this.#reason;
  }

  transitions(): TransitionReferences {
    return this.#transitions;
  }
}
