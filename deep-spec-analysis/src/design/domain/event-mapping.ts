import type { TriggerName } from "@deep-spec/kernel-domain";
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
