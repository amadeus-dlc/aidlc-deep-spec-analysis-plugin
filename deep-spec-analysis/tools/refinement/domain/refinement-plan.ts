// map 検査と被覆分類 — ソルバ不要の決定論部。閉包規則：要件の全義務・全
// シナリオ・全属性は「写像済み／waive 済み／unmapped[] 記載」のどれかで、
// それ以外は mapping-gap（沈黙は契約違反）。gap 文言・witness（map 成果物への
// refs）は golden 凍結。旧 refinement-lib の planUnitRefinement / exprRefs
// からの逐語移植——自由関数は UnitRefinementPlan.of（構築）と plan 自身の
// 照会・skip 導出メソッドになった（OOUI 裁定）。

import { FrRefs, TargetIds, IdOrder } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import { DesignFindings, DesignSkips } from "../../design/domain/index.ts";
import type { DesignFinding, DesignSkipped, DesignUnit } from "../../design/domain/index.ts";
import { AlphaContext } from "./alpha-substitution.ts";
import { RefinementQuintInvariants } from "./quint-invariants.ts";
import type { RefinementQuintInvariant } from "./quint-invariants.ts";
import type { AttributeMapping, RefinementUnitMap, TransitionRef } from "./refinement-map.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export type RefinementStatus =
  | { kind: "checkable" }
  | { kind: "waived"; reason: string }
  | { kind: "gap"; detail: string }
  | { kind: "capability"; detail: string };

function exprRefs(e: Expression, out: Set<string>): void {
  if (e.op === "ref" && typeof e.path === "string") out.add(e.path);
  for (const a of e.args ?? []) exprRefs(a, out);
}

// map 検査の結果（被覆分類・alpha 文脈・写像索引・mapping-gap findings）を
// 閉じ込めた計画。露出 Map は死に、照会・skip 導出は plan 自身の振る舞い。
export class UnitRefinementPlan {
  readonly #ctx: AlphaContext;
  readonly #obligationStatus: ReadonlyMap<string, RefinementStatus>;
  readonly #scenarioStatus: ReadonlyMap<string, RefinementStatus>;
  readonly #eventTransitions: ReadonlyMap<string, readonly TransitionRef[]>;
  readonly #gaps: DesignFindings;

  private constructor(props: {
    ctx: AlphaContext;
    obligationStatus: ReadonlyMap<string, RefinementStatus>;
    scenarioStatus: ReadonlyMap<string, RefinementStatus>;
    eventTransitions: ReadonlyMap<string, readonly TransitionRef[]>;
    gaps: DesignFindings;
  }) {
    this.#ctx = props.ctx;
    this.#obligationStatus = props.obligationStatus;
    this.#scenarioStatus = props.scenarioStatus;
    this.#eventTransitions = props.eventTransitions;
    this.#gaps = props.gaps;
  }

  // 旧 planUnitRefinement の逐語移植（構築ファクトリ）。
  static of(u: DesignUnit, unitMap: RefinementUnitMap, req: RefinementRequirements, mapArtifact: string): UnitRefinementPlan {
    const gaps: DesignFinding[] = [];
    const gap = (targets: string[], detail: string, frRefs: readonly string[] = []): void => {
      gaps.push({
        kind: "mapping-gap",
        frRefs: FrRefs.of(IdOrder.sortedUnique(frRefs, IdOrder.compare)),
        targets: TargetIds.of(IdOrder.sortedUnique(targets, IdOrder.compare)),
        witness: { refs: [{ artifact: mapArtifact, element: `units[${unitMap.unit.asString()}]` }] },
        unit: u.name(),
        detail,
      });
    };
    const byReq = new Map<string, AttributeMapping>();
    const unmapped = unitMap.unmapped;

    for (const m of unitMap.attrMap) {
      if (byReq.has(m.req.asString())) gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap maps "${m.req.asString()}" more than once`);
      byReq.set(m.req.asString(), m);
      const reqAttr = req.attributes().byPath(m.req);
      if (!reqAttr) {
        gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap entry "${m.req.asString()}" names no attribute of the requirements IR`);
        continue;
      }
      if (m.kind === "enum-cases") {
        if (reqAttr.kind !== "enum") {
          gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap entry "${m.req.asString()}" uses enumMap but the requirements attribute is ${reqAttr.kind}`);
        }
        if (!u.attrPaths().has(m.from)) {
          gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.from}" is not a design attribute of unit ${u.name()}`);
          continue;
        }
        const fromValues = u.declaredEnumValuesOf(m.from);
        if (fromValues === null) {
          gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap.from "${m.from}" is not an enum design attribute`);
          continue;
        }
        const missing = fromValues.filter((v) => !(v in m.cases)).sort();
        if (missing.length > 0) {
          gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req.asString()}" is not total over "${m.from}": missing case(s) ${missing.join(", ")}`);
        }
        const badResults = IdOrder.sortedUnique(Object.values(m.cases).filter((rv) => !(reqAttr.values?.includes(rv) ?? false)), IdOrder.compare);
        if (badResults.length > 0) {
          gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `enumMap for "${m.req.asString()}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
        }
      } else if (m.kind === "expression") {
        const refs = new Set<string>();
        exprRefs(m.expr, refs);
        for (const r of [...refs].sort()) {
          if (!u.attrPaths().has(r)) {
            gap([`attr:${m.req.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `attrMap expression for "${m.req.asString()}" references "${r}", which is not a design attribute of unit ${u.name()}`);
          }
        }
      }
    }

    // 属性の閉包：要件の全属性は写像されるか unmapped[] に居る。
    for (const a of req.attributes().sortedByPath()) {
      if (!byReq.has(a.path.asString()) && !unmapped.covers(a.path)) {
        gap(
          [`attr:${a.path.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`],
          `requirements attribute "${a.path.asString()}" is neither mapped by attrMap nor listed in unmapped[] — silence is a contract violation`,
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
      if (unmapped.covers(ob.id)) {
        obligationStatus.set(ob.id.asString(), { kind: "waived", reason: unmapped.reasonOf(ob.id) ?? "listed in unmapped[]" });
        continue;
      }
      if (ob.nature.isStateTemporal()) {
        obligationStatus.set(ob.id.asString(), { kind: "capability", detail: "temporal refinement is outside v1 scope" });
        continue;
      }
      if (ob.nature.isInvariant() || ob.nature.isNumeric()) {
        const cov = attrsCovered(ob.assert);
        if (cov.ok) obligationStatus.set(ob.id.asString(), { kind: "checkable" });
        else if (unmapped.coversAll(cov.missing)) {
          obligationStatus.set(ob.id.asString(), { kind: "waived", reason: `depends on unmapped attribute(s) ${cov.missing.join(", ")}` });
        } else {
          obligationStatus.set(ob.id.asString(), { kind: "gap", detail: `depends on attribute(s) ${cov.missing.join(", ")} that are neither mapped nor in unmapped[]` });
        }
        continue;
      }
      if (ob.nature.isEvent()) {
        const entry = ob.trigger === undefined ? undefined : unitMap.eventMap.ofTrigger(ob.trigger);
        if (entry?.waived) {
          obligationStatus.set(ob.id.asString(), { kind: "waived", reason: entry.waived.reason });
          continue;
        }
        const covG = attrsCovered(ob.guard);
        const covE = attrsCovered(ob.effect);
        const missing = IdOrder.sortedUnique([...covG.missing, ...covE.missing], IdOrder.compare);
        if (!entry || entry.transitions.isEmpty()) {
          obligationStatus.set(ob.id.asString(), { kind: "gap", detail: `requirements event trigger "${ob.trigger ?? "?"}" has no eventMap entry (map it to design transitions or waive it)` });
          continue;
        }
        const badIds = entry.transitions.unknownAmong(designIds);
        if (badIds.length > 0) {
          obligationStatus.set(ob.id.asString(), { kind: "gap", detail: `eventMap for "${ob.trigger}" names unknown design id(s) ${badIds.join(", ")}` });
          continue;
        }
        if (missing.length > 0) {
          if (unmapped.coversAll(missing)) {
            obligationStatus.set(ob.id.asString(), { kind: "waived", reason: `depends on unmapped attribute(s) ${missing.join(", ")}` });
          } else {
            obligationStatus.set(ob.id.asString(), { kind: "gap", detail: `depends on attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]` });
          }
          continue;
        }
        obligationStatus.set(ob.id.asString(), { kind: "checkable" });
        eventTransitions.set(ob.id.asString(), entry.transitions.sortedCanonically());
        continue;
      }
      obligationStatus.set(ob.id.asString(), { kind: "capability", detail: `nature "${ob.nature.asString()}" has no refinement check` });
    }

    const scenarioStatus = new Map<string, RefinementStatus>();
    for (const sc of req.scenarios()) {
      if (unmapped.covers(sc.id)) {
        scenarioStatus.set(sc.id.asString(), { kind: "waived", reason: unmapped.reasonOf(sc.id) ?? "listed in unmapped[]" });
        continue;
      }
      if (sc.event) {
        scenarioStatus.set(sc.id.asString(), { kind: "capability", detail: "event scenarios are not replayed in v1" });
        continue;
      }
      const missing = Object.keys(sc.bindings)
        .filter((p) => !byReq.has(p))
        .sort();
      if (missing.length === 0) scenarioStatus.set(sc.id.asString(), { kind: "checkable" });
      else if (unmapped.coversAll(missing)) {
        scenarioStatus.set(sc.id.asString(), { kind: "waived", reason: `binds unmapped attribute(s) ${missing.join(", ")}` });
      } else {
        scenarioStatus.set(sc.id.asString(), { kind: "gap", detail: `binds attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]` });
      }
    }

    // 義務/シナリオの gap 分類は mapping-gap finding へ昇格する。
    for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => IdOrder.compare(a[0], b[0]))) {
      if (st.kind === "gap") {
        gap([id], `${id}: ${st.detail}`, req.obligationById(id)?.frRefs.toArray() ?? []);
      }
    }
    for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => IdOrder.compare(a[0], b[0]))) {
      if (st.kind === "gap") {
        gap([id], `${id}: ${st.detail}`, req.scenarioById(id)?.frRefs.toArray() ?? []);
      }
    }

    return new UnitRefinementPlan({
      ctx: AlphaContext.of(byReq),
      obligationStatus,
      scenarioStatus,
      eventTransitions,
      gaps: DesignFindings.of(gaps),
    });
  }

  alphaContext(): AlphaContext {
    return this.#ctx;
  }

  gaps(): DesignFindings {
    return this.#gaps;
  }

  // 正準順（IdOrder.compare）の被覆分類——SMT クエリ構築・skip 記録の凍結順。
  sortedObligationStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#obligationStatus.entries()].sort((a, b) => IdOrder.compare(a[0], b[0]));
  }

  sortedScenarioStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#scenarioStatus.entries()].sort((a, b) => IdOrder.compare(a[0], b[0]));
  }

  statusOfObligation(id: string): RefinementStatus | undefined {
    return this.#obligationStatus.get(id);
  }

  statusOfScenario(id: string): RefinementStatus | undefined {
    return this.#scenarioStatus.get(id);
  }

  mappedTransitionsOf(reqId: string): readonly TransitionRef[] {
    return this.#eventTransitions.get(reqId) ?? [];
  }

  // SMT パスの被覆 skip：waived/capability のみ（旧 smtRefinementStatusSkips）。
  smtStatusSkips(unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    const skip = (target: string, reason: string, detail: string): void => {
      skipped.push({ target, reason, unit: unitName, detail });
    };
    for (const [id, st] of this.sortedObligationStatuses()) {
      if (st.kind === "waived") skip(id, "waived", st.reason);
      if (st.kind === "capability") skip(id, "capability", st.detail);
    }
    for (const [id, st] of this.sortedScenarioStatuses()) {
      if (st.kind === "waived") skip(id, "waived", st.reason);
      if (st.kind === "capability") skip(id, "capability", st.detail);
    }
    return DesignSkips.of(skipped);
  }

  // Quint パスの被覆 skip：さらに checkable の event 義務・シナリオを
  // 「SMT 専用検査」の capability として記録（旧 quintRefinementStatusSkips。
  // 走査順は旧実装どおり素の辞書順——IdOrder.compare ではない凍結挙動）。
  quintStatusSkips(req: RefinementRequirements, unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    for (const [rid, st] of [...this.#obligationStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: unitName, detail: st.reason });
      else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: unitName, detail: st.detail });
      else if (st.kind === "checkable") {
        const ob = req.obligationById(rid);
        if (ob !== undefined && ob.nature.isEvent()) {
          skipped.push({ target: rid, reason: "capability", unit: unitName, detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" });
        }
      }
    }
    for (const [rid, st] of [...this.#scenarioStatus.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (st.kind === "waived") skipped.push({ target: rid, reason: "waived", unit: unitName, detail: st.reason });
      else if (st.kind === "capability") skipped.push({ target: rid, reason: "capability", unit: unitName, detail: st.detail });
      else if (st.kind === "checkable") {
        skipped.push({ target: rid, reason: "capability", unit: unitName, detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" });
      }
    }
    return DesignSkips.of(skipped);
  }

  // Quint 側の refinement 追加不変量：checkable な invariant/numeric ごとの
  // alpha(P)（旧 refinementQuintInvariants）。
  quintInvariants(req: RefinementRequirements): RefinementQuintInvariants {
    const out: RefinementQuintInvariant[] = [];
    for (const ob of req.obligations().sortedCanonically()) {
      if (this.#obligationStatus.get(ob.id.asString())?.kind !== "checkable") continue;
      if ((!ob.nature.isInvariant() && !ob.nature.isNumeric()) || !ob.assert) continue;
      try {
        out.push({ reqId: ob.id, frRefs: ob.frRefs, expr: this.#ctx.substitute(ob.assert, false) });
      } catch {
        // SMT パスが compile-error skip として報告する。
      }
    }
    return RefinementQuintInvariants.of(out);
  }
}
