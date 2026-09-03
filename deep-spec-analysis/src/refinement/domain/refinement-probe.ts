import type { TargetId } from "@deep-spec/kernel-domain";
import type { ObligationId, ScenarioId } from "@deep-spec/requirements-domain";
import type { TransitionRef } from "./transition-ref.ts";

// refinement ソルバへ発行した問い 1 件の帰属——どの要件義務／シナリオの、
// どの種類の検査か（invariant・enabledness・simulation は設計遷移との対・
// scenario）。判定の解釈は種類ごとの handler に命じる（`match`）——kind を
// 読んで分岐する代わりに（#71 波22）。
export class RefinementProbe {
  readonly #kind: "invariant" | "enabledness" | "simulation" | "scenario";
  readonly #reqId: ObligationId | ScenarioId;
  readonly #designId: TransitionRef | null;

  private constructor(props: { kind: "invariant" | "enabledness" | "simulation" | "scenario"; reqId: ObligationId | ScenarioId; designId: TransitionRef | null }) {
    this.#kind = props.kind;
    this.#reqId = props.reqId;
    this.#designId = props.designId;
  }

  static invariant(reqId: ObligationId): RefinementProbe {
    return new RefinementProbe({ kind: "invariant", reqId, designId: null });
  }

  static enabledness(reqId: ObligationId): RefinementProbe {
    return new RefinementProbe({ kind: "enabledness", reqId, designId: null });
  }

  static simulation(reqId: ObligationId, designId: TransitionRef): RefinementProbe {
    return new RefinementProbe({ kind: "simulation", reqId, designId });
  }

  static scenario(reqId: ScenarioId): RefinementProbe {
    return new RefinementProbe({ kind: "scenario", reqId, designId: null });
  }

  reqTarget(): TargetId {
    return this.#reqId.asTargetId();
  }

  // 種類ごとの解釈へ命じる。simulation だけが設計遷移との対を渡す。
  match<T>(handlers: {
    invariant: (reqId: ObligationId | ScenarioId) => T;
    enabledness: (reqId: ObligationId | ScenarioId) => T;
    simulation: (reqId: ObligationId | ScenarioId, designId: TransitionRef) => T;
    scenario: (reqId: ObligationId | ScenarioId) => T;
  }): T {
    const kind = this.#kind;
    if (kind === "invariant") return handlers.invariant(this.#reqId);
    if (kind === "enabledness") return handlers.enabledness(this.#reqId);
    if (kind === "scenario") return handlers.scenario(this.#reqId);
    if (this.#designId === null) throw new Error("defect: a simulation probe carries no design transition");
    return handlers.simulation(this.#reqId, this.#designId);
  }
}
