// lowering — 設計ユニット（契約3）を契約1 の要件 IR へ落とす COMPILE-DOWN
// REUSE の中核。遷移は state==from の暗黙ガードと state'=to の効果を持つ
// event 義務へ、ignores は明示 no-op event へ（意図された沈黙が gap /
// deadlock として読まれないように）。設計だけの 2 検査は合成トートロジー
// 不変量で v1 の前件空虚クエリに相乗りする：
//   unreachable — implies(guard, true)：前件（ガード）の非充足性が死そのもの
//   redundancy  — implies(and(guardB, not(guardA)), true)：空虚性が
//                 guardB => guardA を証明し、効果が正準同一なら B は包摂される
// 合成不変量はトートロジーなので、大域・gap・シナリオの判定を変えない。
// OB-n / SC-n / BG-n の採番・整列順は文書バイト（子の処理順）に効く凍結面。
// 旧 deep-spec-design-lib.ts の lowerUnit からの逐語移植（Json 組み立ては
// アダプタの serializer が担い、ここは型付き lowering を返す）。

import { TargetIds, IdOrder, TargetId } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { DesignMachines } from "./design-machines.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignUnit } from "./design-unit.ts";
import { ExpressionCanonicalKey } from "./expression-canonical-key.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkips } from "./design-skips.ts";
import { DesignFinding } from "./design-finding.ts";
import { DesignSkipped } from "./design-skipped.ts";
import type { DesignValue } from "./design-value.ts";

import { type SiblingVerdictDocument } from "./sibling-verdict-document.ts";
import type { LoweredBackground } from "./lowered-background.ts";
import { LoweredBackgrounds } from "./lowered-backgrounds.ts";
import { LoweredId } from "./lowered-id.ts";
import type { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredObligations } from "./lowered-obligations.ts";
import type { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginRef } from "./lowered-origin-ref.ts";
import type { LoweredScenario } from "./lowered-scenario.ts";
import { LoweredScenarios } from "./lowered-scenarios.ts";
import { LoweringIndex } from "./lowering-index.ts";

// lowering の結果（3 コレクション + 帰属索引）。構築（旧 lowerUnit）・
// refinement 追加パスによる不変拡張・v1 判定の設計語彙への remap（旧
// remapUnitDocument）を自身の振る舞いとして持つ（OOUI 裁定）。
export class LoweredUnit {
  readonly #obligations: LoweredObligations;
  readonly #scenarios: LoweredScenarios;
  readonly #background: LoweredBackgrounds;
  readonly #index: LoweringIndex;

  private constructor(props: {
    obligations: LoweredObligations;
    scenarios: LoweredScenarios;
    background: LoweredBackgrounds;
    index: LoweringIndex;
  }) {
    this.#obligations = props.obligations;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#index = props.index;
  }

  obligations(): LoweredObligations {
    return this.#obligations;
  }

  scenarios(): LoweredScenarios {
    return this.#scenarios;
  }

  background(): LoweredBackgrounds {
    return this.#background;
  }

  index(): LoweringIndex {
    return this.#index;
  }

  // refinement 追加パス：追加不変量つき義務列と拡張済み索引での組み直し。
  extendedWith(obligations: LoweredObligations, index: LoweringIndex): LoweredUnit {
    return new LoweredUnit({ obligations, scenarios: this.#scenarios, background: this.#background, index });
  }

  static of(u: DesignUnit, opts: { synthetics: boolean }): LoweredUnit {
    return new LoweredUnit(buildLowering(u, opts));
  }

  // remap — lowered v1 判定を設計語彙（DOB/TR/SM/DSC id・unit 帰属）へ写す。
  // 旧 remapUnitDocument の逐語移植。
  remapVerdicts(u: DesignUnit, doc: SiblingVerdictDocument): {
    readonly findings: DesignFindings;
    readonly skipped: DesignSkips;
    unavailable: string | null;
    method: string | null;
  } {
    if (doc.kind === "unreadable") {
      return { findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: "sibling backend produced no findings document", method: null };
    }
    if (doc.kind === "unavailable") {
      return { findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: doc.reason, method: doc.method };
    }
    const method = doc.method;
    const mapTarget = (t: string): { design: string; entry: LoweredOrigin | null } => this.#index.resolveDesignTarget(t);
    const remapCore = (core: DesignValue): DesignValue => {
      if (!Array.isArray(core)) return core;
      return core.map((label) => (typeof label === "string" ? this.#index.rewriteLoweredIdTokens(label) : label));
    };
    const remapDetail = (detail: string): string => this.#index.rewriteLoweredIds(detail);

    const findings: DesignFinding[] = [];
    const skipped: DesignSkipped[] = [];
    const waived = new Set<string>();
    const deadDesignIds = new Set<string>();
    const shadowFindings: { finding: DesignFinding; subsumer: string; subsumed: string }[] = [];

    for (const f of doc.findings) {
      const mapped = f.targets.map((t) => mapTarget(t.asString()));
      const frRefs = f.frRefs;
      const detail = remapDetail(f.detail);
      let witness = f.witness;
      if (isRecord(witness) && "core" in witness) {
        witness = { core: remapCore(witness.core ?? null) };
      }

      const synth = mapped.find((m) => m.entry?.kind === "vac-dead" || m.entry?.kind === "vac-shadow");
      if (synth?.entry?.kind === "vac-dead" && f.kind === "conflict") {
        const design = synth.entry.design.asString();
        const isTransition = this.#index.isTransition(design);
        deadDesignIds.add(design);
        findings.push(
          DesignFinding.reconstitute({
            kind: "unreachable",
            frRefs,
            targets: TargetIds.reconstitute([design]),
            witness,
            unit: u.name(),
            detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`,
          }),
        );
        continue;
      }
      if (synth?.entry?.kind === "vac-shadow" && f.kind === "conflict") {
        const pairRefs = synth.entry.pair ?? [synth.entry.design, synth.entry.design];
        const pair = [pairRefs[0].asString(), pairRefs[1].asString()] as const;
        shadowFindings.push({
          finding: DesignFinding.reconstitute({
            kind: "redundancy",
            frRefs,
            targets: TargetIds.reconstitute(IdOrder.sortedUnique([pair[0], pair[1]], IdOrder.compare)),
            witness,
            unit: u.name(),
            detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect — it can never apply where ${pair[0]} does not.`,
          }),
          subsumer: pair[0],
          subsumed: pair[1],
        });
        continue;
      }
      if (synth) continue; // 合成に触れる他の判定はノイズ

      const targets = IdOrder.sortedUnique(mapped.map((m) => m.design), IdOrder.compare);
      // deterministic:false waiver：同トリガ conflict の対象がすべて、非決定を
      // 宣言した 1 機械の遷移であるとき（判定は機械自身へ命じる——波7）。
      if (f.kind === "conflict" && targets.length > 0) {
        const machines = targets.map((t) => this.#index.machineOfTransition(t));
        const first = machines[0];
        if (first !== null && first !== undefined && first.waivesOverlapOf(machines)) {
          for (const t of targets) {
            if (!waived.has(t)) {
              waived.add(t);
              skipped.push(DesignSkipped.reconstitute({
                target: TargetId.reconstitute(t),
                reason: "waived",
                unit: u.name(),
                detail: `machine ${first.id().asString()} declares deterministic: false — the same-(state,trigger) overlap check is waived by the model`,
              }));
            }
          }
          continue;
        }
      }
      findings.push(DesignFinding.reconstitute({ kind: f.kind, frRefs, targets: TargetIds.reconstitute(targets), witness, unit: u.name(), detail }));
    }

    // shadow の後段：死んだルール/遷移は既に unreachable——その空虚な包摂は何も
    // 加えない。相互包摂（両方向証明）は 1 件の「等価」finding へ畳む。
    const liveShadows = shadowFindings.filter((s) => !deadDesignIds.has(s.subsumed) && !deadDesignIds.has(s.subsumer));
    const byPair = new Map<string, typeof liveShadows>();
    for (const s of liveShadows) {
      const key = s.finding.targets().joined(",");
      const list = byPair.get(key) ?? [];
      list.push(s);
      byPair.set(key, list);
    }
    for (const key of [...byPair.keys()].sort()) {
      const list = byPair.get(key) ?? [];
      const directions = new Set(list.map((s) => `${s.subsumer}>${s.subsumed}`));
      const first = list[0];
      if (!first) continue;
      if (list.length >= 2 && directions.size >= 2) {
        const [a, b] = first.finding.targets().toStrings();
        findings.push(
          first.finding.withDetail(`${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect — one of them can be removed.`),
        );
      } else {
        findings.push(first.finding);
      }
    }

    const seenSkip = new Set<string>();
    for (const s of doc.skipped) {
      const { design, entry } = mapTarget(s.target.asString());
      if (entry?.kind === "vac-dead" || entry?.kind === "vac-shadow") continue; // 合成の予算ノイズ
      const key = `${design}|${s.reason}`;
      if (seenSkip.has(key)) continue;
      seenSkip.add(key);
      skipped.push(DesignSkipped.reconstitute({
        target: TargetId.reconstitute(design),
        reason: s.reason,
        unit: u.name(),
        ...(typeof s.detail === "string" ? { detail: remapDetail(s.detail) } : {}),
      }));
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}

// SMT 変数名は設計 id の英数字化（remap の witness core 書き換えと同じ規則）。
function isRecord(v: DesignValue): v is { [k: string]: DesignValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function buildLowering(u: DesignUnit, opts: { synthetics: boolean }): {
  obligations: LoweredObligations;
  scenarios: LoweredScenarios;
  background: LoweredBackgrounds;
  index: LoweringIndex;
} {
  const map = new Map<string, LoweredOrigin>();
  const scenarioMap = new Map<string, string>();
  const machineOfTransition = new Map<string, DesignMachine>();
  const attrPathOfMachine = new Map<string, string>();
  const obligations: LoweredObligation[] = [];
  let n = 0;
  const nextId = (): LoweredId => {
    n += 1;
    return LoweredId.reconstitute(`OB-${n}`);
  };
  const push = (ob: Omit<LoweredObligation, "id">, entry: LoweredOrigin): LoweredId => {
    const id = nextId();
    obligations.push({ id, ...ob });
    map.set(id.asString(), entry);
    return id;
  };

  interface EventCandidate {
    lowId: LoweredId;
    design: string;
    trigger: string;
    guard: Expression;
    effect: Expression;
  }
  const candidates: EventCandidate[] = [];

  // 1) 設計義務は素通し（frRefs は帰属のため保持。空の frRefs は lowered
  //    文書で適法——v1 バックエンドは frRefs を不透明な帰属文字列として扱う）。
  for (const ob of u.obligations().sortedCanonically()) {
    const lowered: Omit<LoweredObligation, "id"> = {
      nature: ob.nature().asString(),
      frRefs: [...ob.frRefs()],
    };
    const assertion = ob.assertion();
    const trigger = ob.trigger();
    const guard = ob.guard();
    const effect = ob.effect();
    const temporal = ob.temporal();
    if (assertion !== undefined) lowered.assert = assertion;
    if (trigger !== undefined) lowered.trigger = trigger.asString();
    if (guard !== undefined) lowered.guard = guard;
    if (effect !== undefined) lowered.effect = effect;
    if (temporal !== undefined) lowered.temporal = temporal;
    const lowId = push(lowered, { design: LoweredOriginRef.reconstitute(ob.id().asString()), kind: "passthrough" });
    const event = ob.eventDefinition();
    if (event !== null) {
      candidates.push({ lowId, design: ob.id().asString(), trigger: event.trigger.asString(), guard: event.guard, effect: event.effect });
    }
  }

  // 2) 状態機械のコンパイルダウン：遷移 → 暗黙ガード・効果つき event 義務、
  //    ignores → 明示 no-op event。
  for (const sm of u.machines().sortedCanonically()) {
    const attrPath = DesignMachines.attrPathOf(sm);
    attrPathOfMachine.set(sm.id().asString(), attrPath);
    for (const tr of sm.transitions().sortedCanonically()) {
      // compile-down の暗黙部は遷移／ignore 自身が所有する（波5b）。
      const guard = tr.loweredGuard(attrPath);
      const effect = tr.loweredEffect(attrPath);
      const lowId = push(
        { nature: "event", frRefs: [], trigger: tr.trigger().asString(), guard, effect },
        { design: LoweredOriginRef.reconstitute(tr.id().asString()), kind: "transition" },
      );
      machineOfTransition.set(tr.id().asString(), sm);
      candidates.push({ lowId, design: tr.id().asString(), trigger: tr.trigger().asString(), guard, effect });
    }
    const sortedIgnores = sm.ignores().sortedByStateTrigger();
    for (const ig of sortedIgnores) {
      push(
        { nature: "event", frRefs: [], trigger: ig.trigger().asString(), guard: ig.loweredGuard(attrPath), effect: ig.loweredEffect(attrPath) },
        { design: LoweredOriginRef.reconstitute(sm.id().asString()), kind: "ignore" },
      );
    }
  }

  // 3) 合成トートロジー（SMT lowering のみ）：死ガードと包摂が v1 の前件
  //    空虚検査に相乗りする。
  if (opts.synthetics) {
    for (const c of candidates) {
      push(
        { nature: "invariant", frRefs: [], assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } },
        { design: LoweredOriginRef.reconstitute(c.design), kind: "vac-dead" },
      );
    }
    const byTrigger = new Map<string, EventCandidate[]>();
    for (const c of candidates) {
      const list = byTrigger.get(c.trigger) ?? [];
      list.push(c);
      byTrigger.set(c.trigger, list);
    }
    for (const trigger of [...byTrigger.keys()].sort()) {
      const list = byTrigger.get(trigger) ?? [];
      for (const a of list) {
        for (const b of list) {
          if (a === b) continue;
          if (ExpressionCanonicalKey.of(a.effect) !== ExpressionCanonicalKey.of(b.effect)) continue;
          // (guardB and not guardA) の空虚性は guardB => guardA を証明する：
          // b は a に包摂される（同トリガ・証明可能に狭いガード・同一効果）。
          push(
            {
              nature: "invariant",
              frRefs: [],
              assert: {
                op: "implies",
                args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }],
              },
            },
            {
              design: LoweredOriginRef.reconstitute(`${a.design}|${b.design}`),
              kind: "vac-shadow",
              pair: [LoweredOriginRef.reconstitute(a.design), LoweredOriginRef.reconstitute(b.design)],
            },
          );
        }
      }
    }
  }

  // 4) シナリオと背景。
  const scenarios: LoweredScenario[] = [];
  let scN = 0;
  for (const sc of u.scenarios().sortedCanonically()) {
    scN += 1;
    const lowId = `SC-${scN}`;
    scenarioMap.set(lowId, sc.id().asString());
    const lowered: LoweredScenario = {
      id: LoweredId.reconstitute(lowId),
      kind: sc.kind(),
      frRefs: [...sc.frRefs()],
      bindings: { ...sc.bindings() },
    };
    const eventTrigger = sc.eventTrigger();
    const expectation = sc.expectation();
    if (eventTrigger !== undefined) lowered.event = { trigger: eventTrigger.asString() };
    if (expectation !== undefined) lowered.expect = expectation;
    scenarios.push(lowered);
  }
  const background: LoweredBackground[] = [];
  let bgN = 0;
  for (const bg of u.background().sortedCanonically()) {
    bgN += 1;
    background.push({ id: LoweredId.reconstitute(`BG-${bgN}`), assert: bg.assert });
  }

  return {
    obligations: LoweredObligations.of(obligations),
    scenarios: LoweredScenarios.of(scenarios),
    background: LoweredBackgrounds.of(background),
    index: LoweringIndex.of({
      origins: map,
      scenarioDesignIds: scenarioMap,
      machinesByTransition: machineOfTransition,
      attrPathsByMachine: attrPathOfMachine,
    }),
  };
}
