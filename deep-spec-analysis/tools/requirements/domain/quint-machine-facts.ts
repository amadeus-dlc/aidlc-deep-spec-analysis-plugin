// Quint 状態機械の「事実」——判定解釈に必要な、形式（Quint テキスト）を
// 含まない面。不変量成分（帰属評価に使う式つき）・イベント義務 id・
// 全属性が束縛された init 可能シナリオの集合がここに載る。
// モジュール本文と変数名対応はアダプタのコンパイラが所有する。判定の解釈
// （旧 interpretQuintVerdicts——detail 文言は golden 凍結・返り値は未ソートで
// 正準ソートは VerificationReport.compose の不変条件、phase 2 の「既に skip
// 済みの義務は走らせない」ガードも逐語）は facts 自身の振る舞い（OOUI 裁定）。

import { FrRefs, TargetIds, idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/expression.ts";
import { evaluateExpression } from "./expression-evaluation.ts";
import type { QuintRuns } from "./quint-verdict.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { TraceState } from "./trace-state.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export interface QuintMachineComponent {
  readonly id: string;
  readonly expr: Expression;
  readonly frRefs: readonly string[];
}

// 不変量成分のファーストクラスコレクション。帰属評価（どの成分が最終状態で
// 破れているか）は成分集合自身の知識。
export class QuintMachineComponents {
  readonly #values: readonly QuintMachineComponent[];

  private constructor(values: readonly QuintMachineComponent[]) {
    this.#values = values;
  }

  static of(values: readonly QuintMachineComponent[]): QuintMachineComponents {
    return new QuintMachineComponents([...values]);
  }

  add(value: QuintMachineComponent): QuintMachineComponents {
    return new QuintMachineComponents([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<QuintMachineComponent> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  ids(): readonly string[] {
    return this.#values.map((c) => c.id);
  }

  violatedBy(state: TraceState): QuintMachineComponents {
    return new QuintMachineComponents(this.#values.filter((c) => evaluateExpression(c.expr, state) !== true));
  }

  toArray(): readonly QuintMachineComponent[] {
    return this.#values;
  }
}

export interface QuintMachineFactsSeed {
  readonly invariantComponents: QuintMachineComponents;
  readonly eventIds: readonly string[];
  readonly scenariosWithInit: ReadonlySet<string>;
}

export class QuintMachineFacts {
  readonly #invariantComponents: QuintMachineComponents;
  readonly #eventIds: readonly string[];
  readonly #scenariosWithInit: ReadonlySet<string>;

  private constructor(seed: QuintMachineFactsSeed) {
    this.#invariantComponents = seed.invariantComponents;
    this.#eventIds = seed.eventIds;
    this.#scenariosWithInit = seed.scenariosWithInit;
  }

  static of(seed: QuintMachineFactsSeed): QuintMachineFacts {
    return new QuintMachineFacts({
      invariantComponents: seed.invariantComponents,
      eventIds: [...seed.eventIds],
      scenariosWithInit: new Set(seed.scenariosWithInit),
    });
  }

  hasInvariantComponents(): boolean {
    return !this.#invariantComponents.isEmpty();
  }

  // 機械フェーズが検査する対象の全 id（成分 + イベント義務、正準順・一意）。
  machineTargets(): string[] {
    return sortedUnique([...this.#invariantComponents.ids(), ...this.#eventIds], idCompare);
  }

  // 旧 interpretQuintVerdicts の逐語移植。
  interpret(
    model: RequirementsModel,
    compileSkips: VerificationSkips,
    method: string,
    runs: QuintRuns,
  ): InterpretedQuintVerdicts {
    const bounded = method === "bounded";
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...compileSkips.toArray()];
    const machineTargets = this.machineTargets();

    // 1) イベント機械下で到達可能な不変量違反・デッドロック。
    const machineRun = runs.machineRun();
    if (machineRun !== null) {
      const run = machineRun;
      if (run.kind === "timeout") {
        for (const t of machineTargets) {
          skipped.push({ target: t, reason: "timeout", detail: "machine invariant check exceeded its budget" });
        }
      } else if (run.kind === "deadlock") {
        findings.push({
          kind: "completeness-gap",
          frRefs: FrRefs.of(model.frRefsOf(this.#eventIds)),
          targets: TargetIds.of(this.#eventIds.length > 0 ? [...this.#eventIds].sort(idCompare) : machineTargets),
          witness: run.trace !== null ? { trace: run.trace.toArray() } : { model: {} },
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified.",
        });
      } else if (run.kind === "violation") {
        const violatedComponents = this.#invariantComponents.violatedBy(run.trace.finalState());
        const targets = violatedComponents.isEmpty()
          ? [...this.#eventIds].sort(idCompare)
          : sortedUnique([...violatedComponents.ids()], idCompare);
        findings.push({
          kind: "conflict",
          frRefs: FrRefs.of(model.frRefsOf(sortedUnique([...targets, ...this.#eventIds], idCompare))),
          targets: TargetIds.of(targets),
          witness: { trace: run.trace.toArray() },
          detail: `The event machine can reach a state that violates ${targets.join(", ")} (step trace attached): the event rules do not preserve the obligation.`,
        });
      } else if (run.kind === "run-failed") {
        for (const t of machineTargets) {
          skipped.push({
            target: t,
            reason: "unavailable",
            detail: `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${run.outputTail}`,
          });
        }
      }
    }

    // 2) leads-to 時相義務（bounded のみ。既に skip 済みの義務は対象外）。
    for (const ob of model.obligations()) {
      if (ob.nature !== "state-temporal" || ob.temporal?.pattern !== "leads-to") continue;
      if (skipped.some((s) => s.target === ob.id)) continue;
      if (!bounded) {
        skipped.push({
          target: ob.id,
          reason: "capability",
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them",
        });
        continue;
      }
      const r = runs.temporalOf(ob.id);
      if (!r) continue;
      if (r.kind === "timeout") {
        skipped.push({ target: ob.id, reason: "timeout", detail: "temporal check exceeded its budget" });
      } else if (r.kind === "violation") {
        findings.push({
          kind: "conflict",
          frRefs: FrRefs.of(model.frRefsOf([ob.id])),
          targets: TargetIds.of([ob.id]),
          witness: { trace: r.trace.toArray() },
          detail: `Temporal obligation ${ob.id} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`,
        });
      }
    }

    // 3) シナリオ検査（全属性束縛・イベントなし）：クロスチェック面。
    for (const sc of model.scenarios()) {
      if (sc.event) {
        skipped.push({ target: sc.id, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" });
        continue;
      }
      if (!this.#scenariosWithInit.has(sc.id)) {
        skipped.push({
          target: sc.id,
          reason: "capability",
          detail: "quint scenario evaluation requires bindings for every declared attribute",
        });
        continue;
      }
      const r = runs.scenarioOf(sc.id);
      if (!r) continue;
      if (r.kind === "timeout" || r.kind === "run-failed") {
        skipped.push({
          target: sc.id,
          reason: r.kind === "timeout" ? "timeout" : "unavailable",
          detail: r.kind === "timeout"
            ? "scenario evaluation exceeded its budget"
            : `quint run failed unexpectedly: ${r.outputTail}`,
        });
        continue;
      }
      const state: TraceState & { [path: string]: boolean | number | string } = {};
      for (const [path, value] of Object.entries(sc.bindings)) state[path] = value;
      if (sc.kind === "accept" && r.violated) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = sortedUnique([sc.id, ...violatedComponents.ids()], idCompare);
        findings.push({
          kind: "scenario-violation",
          frRefs: FrRefs.of(model.frRefsOf(targets)),
          targets: TargetIds.of(targets),
          witness: { model: state },
          detail: `Accept scenario ${sc.id} describes a state the obligations rule out — the requirements reject an example that should be accepted.`,
        });
      }
      if (sc.kind === "reject" && !r.violated) {
        findings.push({
          kind: "scenario-violation",
          frRefs: FrRefs.of(model.frRefsOf([sc.id])),
          targets: TargetIds.of([sc.id]),
          witness: { model: state },
          detail: `Reject scenario ${sc.id} is accepted by every obligation — the requirements do not exclude an example that should be rejected.`,
        });
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}

export interface InterpretedQuintVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}
