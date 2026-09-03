// map 検査と被覆分類 — ソルバ不要の決定論部。閉包規則：要件の全義務・全
// シナリオ・全属性は「写像済み／waive 済み／unmapped[] 記載」のどれかで、
// それ以外は mapping-gap（沈黙は契約違反）。gap 文言・witness（map 成果物への
// refs）は golden 凍結。旧 refinement-lib の planUnitRefinement / exprRefs
// からの逐語移植——自由関数は UnitRefinementPlan.of（構築）と plan 自身の
// 照会・skip 導出メソッドになった（OOUI 裁定）。

import { ScenarioId, ObligationId } from "../../requirements/domain/index.ts";
import { ArtifactPath, KeyedIndex, AttributePath } from "../../kernel/domain/index.ts";
import { FrRefs, TargetIds, TargetId } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { DesignFinding, DesignFindings, DesignSkips } from "../../design/domain/index.ts";
import type { DesignUnit } from "../../design/domain/index.ts";
import { DesignSkipped } from "../../design/domain/index.ts";
import type { AttributeMappings } from "./attribute-mappings.ts";
import { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
import { RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
import { type AttributeMapping } from "./attribute-mapping.ts";
import { type RefinementUnitMap } from "./refinement-unit-map.ts";
import { type TransitionRef } from "./transition-ref.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import { RefinementStatus } from "./refinement-status.ts";
import { DesignWitness } from "../../design/domain/index.ts";

function exprRefs(e: Expression, out: Set<string>): void {
  if (e.op === "ref" && typeof e.path === "string") out.add(e.path);
  for (const a of e.args ?? []) exprRefs(a, out);
}

// map 検査の結果（被覆分類・alpha 文脈・写像索引・mapping-gap findings）を
// 閉じ込めた計画。露出 Map は死に、照会・skip 導出は plan 自身の振る舞い。
export class UnitRefinementPlan {
  readonly #mappings: AttributeMappings;
  readonly #obligationStatus: KeyedIndex<ObligationId, RefinementStatus>;
  readonly #scenarioStatus: KeyedIndex<ScenarioId, RefinementStatus>;
  readonly #eventTransitions: KeyedIndex<ObligationId, readonly TransitionRef[]>;
  readonly #gaps: DesignFindings;

  private constructor(props: {
    mappings: AttributeMappings;
    obligationStatus: KeyedIndex<ObligationId, RefinementStatus>;
    scenarioStatus: KeyedIndex<ScenarioId, RefinementStatus>;
    eventTransitions: KeyedIndex<ObligationId, readonly TransitionRef[]>;
    gaps: DesignFindings;
  }) {
    this.#mappings = props.mappings;
    this.#obligationStatus = props.obligationStatus;
    this.#scenarioStatus = props.scenarioStatus;
    this.#eventTransitions = props.eventTransitions;
    this.#gaps = props.gaps;
  }

  // 旧 planUnitRefinement の逐語移植（構築ファクトリ）。
  static of(u: DesignUnit, unitMap: RefinementUnitMap, req: RefinementRequirements, mapArtifact: ArtifactPath): UnitRefinementPlan {
    const gaps: DesignFinding[] = [];
    const gap = (targets: string[], detail: string, frRefs: FrRefs = FrRefs.of([])): void => {
      gaps.push(
        DesignFinding.reconstitute({
          kind: "mapping-gap",
          frRefs: frRefs.sortedUnique(),
          targets: TargetIds.reconstitute(targets).sortedUniqueCanonically(),
          witness: DesignWitness.refs([{ artifact: mapArtifact.asString(), element: `units[${unitMap.unit().asString()}]` }]),
          unit: u.name(),
          detail,
        }),
      );
    };
    const byReq = new Map<string, AttributeMapping>();
    const unmapped = unitMap.unmapped();

    for (const m of unitMap.attrMap()) {
      const reqPath = m.req().asString();
      const gapTarget = [`attr:${reqPath.replace(/[^A-Za-z0-9_./-]/g, "-")}`];
      if (byReq.has(reqPath)) gap(gapTarget, `attrMap maps "${reqPath}" more than once`);
      byReq.set(reqPath, m);
      const reqAttr = req.attributes().byPath(AttributePath.reconstitute(reqPath));
      if (!reqAttr) {
        gap(gapTarget, `attrMap entry "${reqPath}" names no attribute of the requirements IR`);
        continue;
      }
      // 判断は写像へ命じる（波5）——plan は gap 文言（凍結面）だけを所有する。
      if (m.isEnumCases()) {
        const from = m.enumFrom() ?? "";
        if (!reqAttr.isEnum()) {
          gap(gapTarget, `attrMap entry "${reqPath}" uses enumMap but the requirements attribute is ${reqAttr.kind()}`);
        }
        if (!u.attrPaths().has(from)) {
          gap(gapTarget, `enumMap.from "${from}" is not a design attribute of unit ${u.name()}`);
          continue;
        }
        const fromValues = u.declaredEnumValuesOf(from);
        if (fromValues === null) {
          gap(gapTarget, `enumMap.from "${from}" is not an enum design attribute`);
          continue;
        }
        const missing = m.missingCasesOver(fromValues);
        if (missing.length > 0) {
          gap(gapTarget, `enumMap for "${reqPath}" is not total over "${from}": missing case(s) ${missing.join(", ")}`);
        }
        const badResults = m.producedValuesOutside(reqAttr.declaredValues());
        if (badResults.length > 0) {
          gap(gapTarget, `enumMap for "${reqPath}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
        }
      } else if (m.isExpression()) {
        for (const r of m.referencedPaths()) {
          if (!u.attrPaths().has(r)) {
            gap(gapTarget, `attrMap expression for "${reqPath}" references "${r}", which is not a design attribute of unit ${u.name()}`);
          }
        }
      }
    }

    // 属性の閉包：要件の全属性は写像されるか unmapped[] に居る。
    for (const a of req.attributes().sortedByPath()) {
      if (!byReq.has(a.path().asString()) && !unmapped.covers(a.path())) {
        gap(
          [`attr:${a.path().asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`],
          `requirements attribute "${a.path().asString()}" is neither mapped by attrMap nor listed in unmapped[] — silence is a contract violation`,
        );
      }
    }

    const designIds = new Set<string>([...u.obligations().ids(), ...u.machines().transitionIds()]);

    const attrsCovered = (e: Expression | undefined): { ok: boolean; missing: string[] } => {
      if (!e) return { ok: true, missing: [] };
      const refs = new Set<string>();
      exprRefs(e, refs);
      const missing = [...refs].filter((r) => !byReq.has(r)).sort();
      return { ok: missing.length === 0, missing };
    };

    const obligationStatus = new Map<string, RefinementStatus>();
    const eventTransitions = new Map<string, readonly TransitionRef[]>();
    for (const ob of req.obligations()) {
      if (unmapped.covers(ob.id())) {
        obligationStatus.set(ob.id().asString(), RefinementStatus.waived(unmapped.reasonOf(ob.id()) ?? "listed in unmapped[]"));
        continue;
      }
      if (ob.isStateTemporal()) {
        obligationStatus.set(ob.id().asString(), RefinementStatus.capability("temporal refinement is outside v1 scope"));
        continue;
      }
      if (ob.isInvariantLike()) {
        const cov = attrsCovered(ob.assertion());
        if (cov.ok) obligationStatus.set(ob.id().asString(), RefinementStatus.checkable());
        else if (unmapped.coversAll(cov.missing)) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.waived(`depends on unmapped attribute(s) ${cov.missing.join(", ")}`));
        } else {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`depends on attribute(s) ${cov.missing.join(", ")} that are neither mapped nor in unmapped[]`));
        }
        continue;
      }
      if (ob.isEvent()) {
        const trigger = ob.trigger();
        const entry = trigger === undefined ? undefined : unitMap.eventMappingOf(trigger);
        const waiver = entry?.waiverReason() ?? null;
        if (waiver !== null) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.waived(waiver));
          continue;
        }
        const covG = attrsCovered(ob.guard());
        const covE = attrsCovered(ob.effect());
        const missing = [...new Set([...covG.missing, ...covE.missing])].sort((a, b) => AttributePath.reconstitute(a).compareTo(AttributePath.reconstitute(b)));
        if (!entry || entry.transitions().isEmpty()) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`requirements event trigger "${trigger === undefined ? "?" : trigger.asString()}" has no eventMap entry (map it to design transitions or waive it)`));
          continue;
        }
        const badIds = entry.transitions().unknownAmong(designIds);
        if (badIds.length > 0) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`eventMap for "${trigger?.asString()}" names unknown design id(s) ${badIds.join(", ")}`));
          continue;
        }
        if (missing.length > 0) {
          if (unmapped.coversAll(missing)) {
            obligationStatus.set(ob.id().asString(), RefinementStatus.waived(`depends on unmapped attribute(s) ${missing.join(", ")}`));
          } else {
            obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`depends on attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]`));
          }
          continue;
        }
        obligationStatus.set(ob.id().asString(), RefinementStatus.checkable());
        eventTransitions.set(ob.id().asString(), entry.transitions().sortedCanonically());
        continue;
      }
      obligationStatus.set(ob.id().asString(), RefinementStatus.capability(`nature "${ob.nature().asString()}" has no refinement check`));
    }

    const scenarioStatus = new Map<string, RefinementStatus>();
    for (const sc of req.scenarios()) {
      if (unmapped.covers(sc.id())) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.waived(unmapped.reasonOf(sc.id()) ?? "listed in unmapped[]"));
        continue;
      }
      if (sc.hasEvent()) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.capability("event scenarios are not replayed in v1"));
        continue;
      }
      const missing = Object.keys(sc.bindings())
        .filter((p) => !byReq.has(p))
        .sort();
      if (missing.length === 0) scenarioStatus.set(sc.id().asString(), RefinementStatus.checkable());
      else if (unmapped.coversAll(missing)) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.waived(`binds unmapped attribute(s) ${missing.join(", ")}`));
      } else {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.gap(`binds attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]`));
      }
    }

    // 義務/シナリオの gap 分類は mapping-gap finding へ昇格する。
    for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])))) {
      const gapDetail = st.gapDetail();
        if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.obligationById(id)?.frRefs() ?? FrRefs.of([]));
      }
    }
    for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])))) {
      const gapDetail = st.gapDetail();
        if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.scenarioById(id)?.frRefs() ?? FrRefs.of([]));
      }
    }

    return new UnitRefinementPlan({
      mappings: unitMap.attrMap(),
      obligationStatus: KeyedIndex.of([...obligationStatus].map(([id, st]) => [ObligationId.reconstitute(id), st] as const)),
      scenarioStatus: KeyedIndex.of([...scenarioStatus].map(([id, st]) => [ScenarioId.reconstitute(id), st] as const)),
      eventTransitions: KeyedIndex.of([...eventTransitions].map(([id, trs]) => [ObligationId.reconstitute(id), trs] as const)),
      gaps: DesignFindings.of(gaps),
    });
  }

  // 承認済み写像——alpha 置換の門（裁定 10）。
  attributeMappings(): AttributeMappings {
    return this.#mappings;
  }

  gaps(): DesignFindings {
    return this.#gaps;
  }

  // 正準順（TargetId.compareTo）の被覆分類——SMT クエリ構築・skip 記録の凍結順。
  sortedObligationStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#obligationStatus].map(([id, st]) => [id.asString(), st] as const).sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])));
  }

  sortedScenarioStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#scenarioStatus].map(([id, st]) => [id.asString(), st] as const).sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])));
  }

  statusOfObligation(id: string): RefinementStatus | undefined {
    return this.#obligationStatus.get(ObligationId.reconstitute(id));
  }

  statusOfScenario(id: string): RefinementStatus | undefined {
    return this.#scenarioStatus.get(ScenarioId.reconstitute(id));
  }

  mappedTransitionsOf(reqId: string): readonly TransitionRef[] {
    return this.#eventTransitions.get(ObligationId.reconstitute(reqId)) ?? [];
  }

  // SMT パスの被覆 skip：waived/capability のみ（旧 smtRefinementStatusSkips）。
  smtStatusSkips(unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    for (const [id, st] of this.sortedObligationStatuses()) {
      const s = st.skipFor(TargetId.reconstitute(id), unitName);
      if (s !== null) skipped.push(s);
    }
    for (const [id, st] of this.sortedScenarioStatuses()) {
      const s = st.skipFor(TargetId.reconstitute(id), unitName);
      if (s !== null) skipped.push(s);
    }
    return DesignSkips.of(skipped);
  }

  // Quint パスの被覆 skip：さらに checkable の event 義務・シナリオを
  // 「SMT 専用検査」の capability として記録（旧 quintRefinementStatusSkips。
  // 走査順は旧実装どおり素の辞書順——正準順ではない凍結挙動）。
  quintStatusSkips(req: RefinementRequirements, unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    for (const [rid, st] of [...this.#obligationStatus].map(([id, status]) => [id.asString(), status] as const).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const s = st.skipFor(TargetId.reconstitute(rid), unitName);
      if (s !== null) skipped.push(s);
      else if (st.isCheckable()) {
        const ob = req.obligationById(rid);
        if (ob !== undefined && ob.isEvent()) {
          skipped.push(DesignSkipped.reconstitute({ target: TargetId.reconstitute(rid), reason: "capability", unit: unitName, detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" }));
        } else if (ob !== undefined && ob.isInvariantLike()) {
          const assertion = ob.assertion();
          if (assertion === undefined) continue;
          // alpha 置換の失敗を Quint 文書にも記録する（凍結解除 #38 項 1——
          // 旧挙動は義務が痕跡なく落ち、SMT 側だけが報告していた）。文言は
          // SMT 側の compile-error skip と逐語で対。
          const substituted = this.#mappings.substitute(assertion, false);
          if (!substituted.ok) skipped.push(substituted.error.asCompileErrorSkip(TargetId.reconstitute(rid), unitName));
        }
      }
    }
    for (const [rid, st] of [...this.#scenarioStatus].map(([id, status]) => [id.asString(), status] as const).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const s = st.skipFor(TargetId.reconstitute(rid), unitName);
      if (s !== null) skipped.push(s);
      else if (st.isCheckable()) {
        skipped.push(DesignSkipped.reconstitute({ target: TargetId.reconstitute(rid), reason: "capability", unit: unitName, detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" }));
      }
    }
    return DesignSkips.of(skipped);
  }

  // Quint 側の refinement 追加不変量：checkable な invariant/numeric ごとの
  // alpha(P)（旧 refinementQuintInvariants）。
  quintInvariants(req: RefinementRequirements): RefinementQuintInvariants {
    const out: RefinementQuintInvariant[] = [];
    for (const ob of req.obligations().sortedCanonically()) {
      if (!this.#obligationStatus.get(ob.id())?.isCheckable()) continue;
      const assertion = ob.assertion();
      if (!ob.isInvariantLike() || assertion === undefined) continue;
      const substituted = this.#mappings.substitute(assertion, false);
      // 欠陥は quintStatusSkips が compile-error skip として記録する（SMT 側と対）。
      if (substituted.ok) out.push(RefinementQuintInvariant.of(ob.id(), ob.frRefs(), substituted.value));
    }
    return RefinementQuintInvariants.of(out);
  }
}
