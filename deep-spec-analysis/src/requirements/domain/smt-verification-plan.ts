// SMT 検証計画——コンパイラが要件モデルを SMT クエリに変換したときの対応表
// （形式 SMT-LIB を含まない面）。計画は値オブジェクト（種別規律の裁定 7、
// 2026-09-02——「事実」の名はドメインイベントに取っておく）。
// クエリ id（"global" / "vac:OB-x" / "evo:a:b" / "evj:a:b" / "gap:trigger" /
// "sc:SC-x"）とラベル→対象の対応、コンパイル時 skip がここに載る。
// スクリプト本体はアダプタの計画ビルダが所有する。判定の解釈（旧
// interpretSmtVerdicts——detail 文言は golden 凍結・返り値は未ソートで正準
// ソートは VerificationReport.compose の不変条件）は plan 自身の振る舞い
// （OOUI 裁定）。

import { TargetIds, KeySet, KeyedIndex, QueryLabel, TargetId, TriggerName } from "@deep-spec/kernel-domain";
import type { RequirementsModel } from "./requirements-model.ts";
import { type SmtQueryVerdicts } from "./smt-query-verdicts.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";

import { SmtEventPairProbes } from "./smt-event-pair-probes.ts";
import { VerificationWitness } from "./verification-witness.ts";
import type { ObligationId } from "./obligation-id.ts";
import type { ScenarioId } from "./scenario-id.ts";

export class SmtVerificationPlan {
  readonly #compiled: KeySet<ObligationId>;
  readonly #skipped: VerificationSkips;
  readonly #labelToTarget: KeyedIndex<QueryLabel, TargetId>;
  readonly #eventPairs: SmtEventPairProbes;
  readonly #gapTriggers: KeyedIndex<TriggerName, TargetIds>;
  readonly #scenarioQueries: KeyedIndex<ScenarioId, QueryLabel>;

  private constructor(seed: {
    readonly compiled: KeySet<ObligationId>;
    readonly skipped: VerificationSkips;
    readonly labelToTarget: KeyedIndex<QueryLabel, TargetId>;
    readonly eventPairs: SmtEventPairProbes;
    readonly gapTriggers: KeyedIndex<TriggerName, TargetIds>;
    readonly scenarioQueries: KeyedIndex<ScenarioId, QueryLabel>;
  }) {
    this.#compiled = seed.compiled;
    this.#skipped = seed.skipped;
    this.#labelToTarget = seed.labelToTarget;
    this.#eventPairs = seed.eventPairs;
    this.#gapTriggers = seed.gapTriggers;
    this.#scenarioQueries = seed.scenarioQueries;
  }

  static of(seed: {
    readonly compiled: KeySet<ObligationId>;
    readonly skipped: VerificationSkips;
    readonly labelToTarget: KeyedIndex<QueryLabel, TargetId>;
    readonly eventPairs: SmtEventPairProbes;
    readonly gapTriggers: KeyedIndex<TriggerName, TargetIds>;
    readonly scenarioQueries: KeyedIndex<ScenarioId, QueryLabel>;
  }): SmtVerificationPlan {
    return new SmtVerificationPlan({
      compiled: seed.compiled,
      skipped: seed.skipped,
      labelToTarget: seed.labelToTarget,
      eventPairs: seed.eventPairs,
      gapTriggers: seed.gapTriggers,
      scenarioQueries: seed.scenarioQueries,
    });
  }

  // ソルバ実行不能でも文書に載るコンパイル時 skip（unavailable 文書用）。
  planSkipped(): VerificationSkips {
    return this.#skipped;
  }

  // 旧 interpretSmtVerdicts の逐語移植。
  interpret(model: RequirementsModel, results: SmtQueryVerdicts): {
    findings: VerificationFindings;
    skipped: VerificationSkips;
  } {
    const findings: VerificationFinding[] = [];
    const skipped: VerificationSkipped[] = [...this.#skipped.toArray()];
    const conflictKeys = new Set<string>();
    const invariantIds = TargetIds.of(
      model
        .obligations()
        .toArray()
        .filter((o) => o.isInvariantLike() && this.#compiled.has(o.id()))
        .map((o) => o.id().asTargetId()),
    );

    // ラベル→対象の対応（seed の生 id 材料）から義務 id だけを対象列へ。
    const coreToTargets = (core: readonly QueryLabel[]): TargetIds => {
      const targets = core
        .map((label) => this.#labelToTarget.get(label))
        .filter((t): t is TargetId => t !== undefined && t.asString().startsWith("OB-"));
      return TargetIds.of(targets).sortedUniqueCanonically();
    };

    const addConflict = (targets: TargetIds, core: readonly QueryLabel[], detail: string): void => {
      const effective = targets.count() > 0 ? targets : invariantIds;
      if (effective.count() === 0) return;
      const key = effective.joined(",");
      if (conflictKeys.has(key)) return;
      conflictKeys.add(key);
      findings.push(VerificationFinding.reconstitute({
        kind: "conflict",
        frRefs: model.frRefsOf(effective),
        targets: effective,
        witness: VerificationWitness.core(core.map((label) => label.asString()).sort()),
        detail,
      }));
    };

    const timeoutSkip = (targets: TargetIds, what: string): void => {
      for (const t of targets) {
        skipped.push(VerificationSkipped.reconstitute({ target: t, reason: "timeout", detail: `${what} exceeded the solver budget` }));
      }
    };

    // (a) 大域一貫性。
    const global = results.verdictOf(QueryLabel.reconstitute("global"));
    let globallyUnsat = false;
    if (global?.isUnsat()) {
      globallyUnsat = true;
      addConflict(
        coreToTargets([...global.coreLabels()]),
        [...global.coreLabels()],
        "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.",
      );
    } else if (global?.isUndecided()) {
      timeoutSkip(invariantIds, "global consistency check");
    }

    // (a) 前件空虚（大域 unsat のときは冗長な派生なので黙る）。
    if (!globallyUnsat) {
      for (const ob of model.obligations()) {
        const r = results.verdictOf(QueryLabel.reconstitute(`vac:${ob.id().asString()}`));
        if (!r) continue;
        if (r.isUnsat()) {
          const targets = TargetIds.of([...coreToTargets([...r.coreLabels()]), ob.id().asTargetId()]).sortedUniqueCanonically();
          addConflict(
            targets,
            [...r.coreLabels()],
            `The condition of obligation ${ob.id().asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`,
          );
        } else if (r.isUndecided()) {
          timeoutSkip(TargetIds.of([ob.id().asTargetId()]), `vacuity check for ${ob.id().asString()}`);
        }
      }
    }

    // (a) 同トリガの矛盾効果。
    for (const pair of this.#eventPairs) {
      const overlap = pair.overlapVerdictIn(results);
      const joint = pair.jointVerdictIn(results);
      if (!overlap || !joint) continue;
      if (overlap.isSat() && joint.isUnsat()) {
        addConflict(
          pair.targets().sortedUniqueCanonically(),
          [...joint.coreLabels()],
          `Events ${pair.a().asString()} and ${pair.b().asString()} for trigger "${pair.trigger().asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`,
        );
      } else if (overlap.isUndecided() || joint.isUndecided()) {
        // 未決（unknown/budget/error）は skip——3 状態の列挙が interpret ごとに
        // 散在していたのが #34 項 3 の土壌で、判定面 isUndecided() に収束した
        //（主従の裁定 #71 波2）。
        timeoutSkip(pair.targets(), `event-pair check for trigger "${pair.trigger().asString()}"`);
      }
    }

    // (b) 完全性ギャップ。
    for (const [triggerName, eventIds] of [...this.#gapTriggers].sort((a, b) => (a[0].asString() < b[0].asString() ? -1 : a[0].asString() > b[0].asString() ? 1 : 0))) {
      const trigger = triggerName.asString();
      const r = results.verdictOf(QueryLabel.reconstitute(`gap:${trigger}`));
      if (!r) continue;
      if (r.isSat()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "completeness-gap",
          frRefs: model.frRefsOf(eventIds),
          targets: eventIds,
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`,
        }));
      } else if (r.isUndecided()) {
        timeoutSkip(eventIds, `completeness check for trigger "${trigger}"`);
      }
    }

    // (c) シナリオ。
    for (const sc of model.scenarios()) {
      const qid = this.#scenarioQueries.get(sc.id());
      if (!qid) continue;
      const r = results.verdictOf(qid);
      if (!r) continue;
      if (r.isUndecided()) {
        timeoutSkip(TargetIds.of([sc.id().asTargetId()]), `scenario check for ${sc.id().asString()}`);
        continue;
      }
      if (sc.isAccept() && r.isUnsat()) {
        const targets = TargetIds.of([sc.id().asTargetId(), ...coreToTargets([...r.coreLabels()])]).sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.core(r.sortedCore()),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations in the witness core rule out — the requirements reject an example that should be accepted.`,
        }));
      }
      if (sc.isReject() && r.isSat()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(TargetIds.of([sc.id().asTargetId()])),
          targets: TargetIds.of([sc.id().asTargetId()]),
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `Reject scenario ${sc.id().asString()} is still satisfiable — the requirements do not exclude an example that should be rejected (witness state attached).`,
        }));
      }
    }

    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
