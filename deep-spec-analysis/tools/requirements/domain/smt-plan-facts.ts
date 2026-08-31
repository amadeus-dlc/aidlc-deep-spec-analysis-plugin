// SMT 検証計画の「事実」——判定解釈に必要な、形式（SMT-LIB）を含まない面。
// クエリ id（"global" / "vac:OB-x" / "evo:a:b" / "evj:a:b" / "gap:trigger" /
// "sc:SC-x"）とラベル→対象の対応、コンパイル時 skip がここに載る。
// スクリプト本体はアダプタの計画ビルダが所有する。判定の解釈（旧
// interpretSmtVerdicts——detail 文言は golden 凍結・返り値は未ソートで正準
// ソートは VerificationReport.compose の不変条件）は facts 自身の振る舞い
// （OOUI 裁定）。

import type { TriggerName } from "../../kernel/domain/index.ts";
import type { ObligationId } from "./obligation.ts";
import { FrRefs, TargetIds, IdOrder } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SmtQueryVerdicts } from "./solver-verdict.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export interface SmtEventPairProbe {
  readonly qOverlap: string;
  readonly qJoint: string;
  readonly a: ObligationId;
  readonly b: ObligationId;
  readonly trigger: TriggerName;
}

// 同トリガ event 対プローブのファーストクラスコレクション（発行順を保持）。
export class SmtEventPairProbes {
  readonly #values: readonly SmtEventPairProbe[];

  private constructor(values: readonly SmtEventPairProbe[]) {
    this.#values = values;
  }

  static of(values: readonly SmtEventPairProbe[]): SmtEventPairProbes {
    return new SmtEventPairProbes([...values]);
  }

  add(value: SmtEventPairProbe): SmtEventPairProbes {
    return new SmtEventPairProbes([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SmtEventPairProbe> {
    yield* this.#values;
  }

  toArray(): readonly SmtEventPairProbe[] {
    return this.#values;
  }
}

export interface InterpretedVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}

export interface SmtPlanFactsSeed {
  readonly compiled: ReadonlyMap<string, boolean>;
  readonly skipped: VerificationSkips;
  readonly labelToTarget: ReadonlyMap<string, string>;
  readonly eventPairs: SmtEventPairProbes;
  readonly gapTriggers: ReadonlyMap<string, readonly string[]>;
  readonly scenarioQueries: ReadonlyMap<string, string>;
}

export class SmtPlanFacts {
  readonly #compiled: ReadonlyMap<string, boolean>;
  readonly #skipped: VerificationSkips;
  readonly #labelToTarget: ReadonlyMap<string, string>;
  readonly #eventPairs: SmtEventPairProbes;
  readonly #gapTriggers: ReadonlyMap<string, readonly string[]>;
  readonly #scenarioQueries: ReadonlyMap<string, string>;

  private constructor(seed: SmtPlanFactsSeed) {
    this.#compiled = seed.compiled;
    this.#skipped = seed.skipped;
    this.#labelToTarget = seed.labelToTarget;
    this.#eventPairs = seed.eventPairs;
    this.#gapTriggers = seed.gapTriggers;
    this.#scenarioQueries = seed.scenarioQueries;
  }

  static of(seed: SmtPlanFactsSeed): SmtPlanFacts {
    return new SmtPlanFacts({
      compiled: new Map(seed.compiled),
      skipped: seed.skipped,
      labelToTarget: new Map(seed.labelToTarget),
      eventPairs: seed.eventPairs,
      gapTriggers: new Map(seed.gapTriggers),
      scenarioQueries: new Map(seed.scenarioQueries),
    });
  }

  // ソルバ実行不能でも文書に載るコンパイル時 skip（unavailable 文書用）。
  planSkipped(): VerificationSkips {
    return this.#skipped;
  }

  // 旧 interpretSmtVerdicts の逐語移植。
  interpret(model: RequirementsModel, results: SmtQueryVerdicts): InterpretedVerdicts {
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...this.#skipped.toArray()];
    const conflictKeys = new Set<string>();
    const invariantIds = model
      .obligations()
      .toArray()
      .filter((o) => (o.nature.isInvariant() || o.nature.isNumeric()) && this.#compiled.get(o.id.asString()))
      .map((o) => o.id.asString());

    const coreToTargets = (core: string[]): string[] => {
      const targets = core
        .map((label) => this.#labelToTarget.get(label))
        .filter((t): t is string => typeof t === "string" && t.startsWith("OB-"));
      return IdOrder.sortedUnique(targets, IdOrder.compare);
    };

    const addConflict = (targets: string[], core: string[], detail: string): void => {
      const effective = targets.length > 0 ? targets : invariantIds;
      if (effective.length === 0) return;
      const key = effective.join(",");
      if (conflictKeys.has(key)) return;
      conflictKeys.add(key);
      findings.push({
        kind: "conflict",
        frRefs: FrRefs.of(model.frRefsOf(effective)),
        targets: TargetIds.of(effective),
        witness: { core: [...core].sort() },
        detail,
      });
    };

    const timeoutSkip = (targets: string[], what: string): void => {
      for (const t of targets) {
        skipped.push({ target: t, reason: "timeout", detail: `${what} exceeded the solver budget` });
      }
    };

    // (a) 大域一貫性。
    const global = results.verdictOf("global");
    let globallyUnsat = false;
    if (global?.status === "unsat") {
      globallyUnsat = true;
      addConflict(
        coreToTargets(global.core ?? []),
        global.core ?? [],
        "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
      );
    } else if (global && global.status !== "sat") {
      timeoutSkip(invariantIds, "global consistency check");
    }

    // (a) 前件空虚（大域 unsat のときは冗長な派生なので黙る）。
    if (!globallyUnsat) {
      for (const ob of model.obligations()) {
        const r = results.verdictOf(`vac:${ob.id.asString()}`);
        if (!r) continue;
        if (r.status === "unsat") {
          const targets = IdOrder.sortedUnique([...coreToTargets(r.core ?? []), ob.id.asString()], IdOrder.compare);
          addConflict(
            targets,
            r.core ?? [],
            `The condition of obligation ${ob.id.asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`,
          );
        } else if (r.status !== "sat") {
          timeoutSkip([ob.id.asString()], `vacuity check for ${ob.id.asString()}`);
        }
      }
    }

    // (a) 同トリガの矛盾効果。
    for (const pair of this.#eventPairs) {
      const overlap = results.verdictOf(pair.qOverlap);
      const joint = results.verdictOf(pair.qJoint);
      if (!overlap || !joint) continue;
      if (overlap.status === "sat" && joint.status === "unsat") {
        addConflict(
          IdOrder.sortedUnique([pair.a.asString(), pair.b.asString()], IdOrder.compare),
          joint.core ?? [],
          `Events ${pair.a.asString()} and ${pair.b.asString()} for trigger "${pair.trigger.asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`,
        );
      } else if (overlap.status === "unknown" || overlap.status === "budget" || joint.status === "unknown" || joint.status === "budget") {
        timeoutSkip([pair.a.asString(), pair.b.asString()], `event-pair check for trigger "${pair.trigger.asString()}"`);
      }
    }

    // (b) 完全性ギャップ。
    for (const [trigger, eventIds] of [...this.#gapTriggers.entries()].sort()) {
      const r = results.verdictOf(`gap:${trigger}`);
      if (!r) continue;
      if (r.status === "sat") {
        findings.push({
          kind: "completeness-gap",
          frRefs: FrRefs.of(model.frRefsOf(eventIds)),
          targets: TargetIds.of([...eventIds]),
          witness: { model: r.decodedModel ?? {} },
          detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`,
        });
      } else if (r.status !== "unsat") {
        timeoutSkip([...eventIds], `completeness check for trigger "${trigger}"`);
      }
    }

    // (c) シナリオ。
    for (const sc of model.scenarios()) {
      const qid = this.#scenarioQueries.get(sc.id.asString());
      if (!qid) continue;
      const r = results.verdictOf(qid);
      if (!r) continue;
      if (r.status === "unknown" || r.status === "budget" || r.status === "error") {
        timeoutSkip([sc.id.asString()], `scenario check for ${sc.id.asString()}`);
        continue;
      }
      if (sc.kind === "accept" && r.status === "unsat") {
        const targets = IdOrder.sortedUnique([sc.id.asString(), ...coreToTargets(r.core ?? [])], IdOrder.compare);
        findings.push({
          kind: "scenario-violation",
          frRefs: FrRefs.of(model.frRefsOf(targets)),
          targets: TargetIds.of(targets),
          witness: { core: [...(r.core ?? [])].sort() },
          detail: `Accept scenario ${sc.id.asString()} describes a state the obligations in the witness core rule out — the requirements reject an example that should be accepted.`,
        });
      }
      if (sc.kind === "reject" && r.status === "sat") {
        findings.push({
          kind: "scenario-violation",
          frRefs: FrRefs.of(model.frRefsOf([sc.id.asString()])),
          targets: TargetIds.of([sc.id.asString()]),
          witness: { model: r.decodedModel ?? {} },
          detail: `Reject scenario ${sc.id.asString()} is still satisfiable — the requirements do not exclude an example that should be rejected (witness state attached).`,
        });
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
