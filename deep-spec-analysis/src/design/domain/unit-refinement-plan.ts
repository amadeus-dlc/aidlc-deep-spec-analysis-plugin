import {
  type ArtifactPath,
  KeyedIndex,
  SkipReason,
  TargetIdentifier,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RefinementStatus } from "./refinement-status.ts";

// 写像と義務・シナリオが導いた診断、被覆状態、遷移対応を保持する精緻化計画。
// 対象の分類は各対象が所有し、計画は検証方式ごとの実行準備を調整する。

import { ObligationIdentifier, ScenarioIdentifier } from "@deep-spec-analysis/requirements-domain";
import type { AttributeMappings } from "./attribute-mappings.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignReport } from "./design-report.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweredUnit } from "./lowered-unit.ts";
import { RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
import { RefinementQuintInvariants } from "./refinement-quint-invariants.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";
import type { SiblingVerificationResult } from "./sibling-verification-result.ts";
import type { TransitionReference } from "./transition-reference.ts";

// 準備時に分類した対象と診断を、不変の索引として保持する。
export class UnitRefinementPlan {
  readonly #unit: DesignUnit;
  readonly #requirements: RefinementRequirements;
  readonly #mappings: AttributeMappings;
  readonly #obligationStatus: KeyedIndex<ObligationIdentifier, RefinementStatus>;
  readonly #scenarioStatus: KeyedIndex<ScenarioIdentifier, RefinementStatus>;
  readonly #eventTransitions: KeyedIndex<ObligationIdentifier, readonly TransitionReference[]>;
  readonly #gaps: DesignFindings;

  private constructor(
    unit: DesignUnit,
    map: RefinementUnitMap,
    requirements: RefinementRequirements,
    artifact: ArtifactPath,
  ) {
    if (!map.isForUnit(unit.id())) throw new IllegalArgumentException({ kind: "refinement-unit-mismatch" });
    const obligations: (readonly [ObligationIdentifier, RefinementStatus])[] = [];
    const transitions: (readonly [ObligationIdentifier, readonly TransitionReference[]])[] = [];
    const scenarios: (readonly [ScenarioIdentifier, RefinementStatus])[] = [];
    let gaps = map.attrMap().diagnostics(unit, requirements, map, artifact);
    for (const obligation of requirements.obligations().sortedCanonically()) {
      const status = obligation.coverageIn(map, unit);
      obligations.push([obligation.id(), status]);
      if (status.isCheckable() && obligation.isEvent())
        transitions.push([obligation.id(), obligation.mappedTransitionsIn(map).sortedCanonically()]);
      const finding = status.findingFor(
        obligation.id().asTargetId(),
        obligation.functionalRequirementReferences(),
        map,
        artifact,
      );
      if (finding !== null) gaps = gaps.add(finding);
    }
    for (const scenario of requirements.scenarios().sortedCanonically()) {
      const status = scenario.coverageIn(map);
      scenarios.push([scenario.id(), status]);
      const finding = status.findingFor(
        scenario.id().asTargetId(),
        scenario.functionalRequirementReferences(),
        map,
        artifact,
      );
      if (finding !== null) gaps = gaps.add(finding);
    }
    this.#unit = unit;
    this.#requirements = requirements;
    this.#mappings = map.attrMap();
    this.#obligationStatus = KeyedIndex.of(obligations);
    this.#scenarioStatus = KeyedIndex.of(scenarios);
    this.#eventTransitions = KeyedIndex.of(transitions);
    this.#gaps = gaps;
  }

  static of(
    unit: DesignUnit,
    map: RefinementUnitMap,
    requirements: RefinementRequirements,
    artifact: ArtifactPath,
  ): UnitRefinementPlan {
    return new UnitRefinementPlan(unit, map, requirements, artifact);
  }
  static parse(
    unit: DesignUnit,
    map: RefinementUnitMap,
    requirements: RefinementRequirements,
    artifact: ArtifactPath,
  ): Result<UnitRefinementPlan, ParseError> {
    return parseConstruction(() => new UnitRefinementPlan(unit, map, requirements, artifact));
  }

  // adapterのコンパイル入力。applicationは計画をそのままgatewayへ渡す。
  unit(): DesignUnit {
    return this.#unit;
  }
  requirements(): RefinementRequirements {
    return this.#requirements;
  }

  hasQuintInvariants(): boolean {
    return !this.quintInvariants(this.#requirements).isEmpty();
  }

  loweredForQuint(): Result<LoweredUnit, ParseError> {
    const lowered = this.#unit.lowered({ synthetics: false });
    return lowered.ok ? lowered.value.extendedWith(this.quintInvariants(this.#requirements)) : lowered;
  }

  quintPreparedIn(report: DesignReport): DesignReport {
    return report.withEvidence(this.#gaps, this.quintStatusSkips(this.#requirements, this.#unit.name()));
  }

  quintRecordedIn(report: DesignReport, result: SiblingVerificationResult): DesignReport {
    const lowered = this.loweredForQuint();
    if (!lowered.ok) return this.loweringFailedIn(report, lowered.error);
    const interpreted = result.interpretRefinement(this.#unit, lowered.value, this.quintInvariants(this.#requirements));
    return report.withEvidence(interpreted.findings, interpreted.skipped);
  }

  loweringFailedIn(report: DesignReport, problem: ParseError): DesignReport {
    return this.unverifiedIn(report, SkipReason.compileError(), `refinement lowering failed: ${problem.kind}`);
  }

  quintTimedOut(report: DesignReport): DesignReport {
    const skipped = DesignSkips.forTargets(
      this.quintInvariants(this.#requirements).reqTargets(),
      UnitName.of(this.#unit.name()),
      SkipReason.timeout(),
      "the per-run backend budget was exhausted before the refinement pass",
    );
    return report.withEvidence(DesignFindings.of([]), skipped);
  }

  smtTimedOut(report: DesignReport): DesignReport {
    return this.unverifiedIn(
      report,
      SkipReason.timeout(),
      "the per-run solver budget was exhausted before the refinement pass",
    );
  }

  unverifiedIn(report: DesignReport, reason: SkipReason, detail: string): DesignReport {
    return report.withEvidence(
      DesignFindings.of([]),
      DesignSkips.forTargets(this.#requirements.allTargetIds(), UnitName.of(this.#unit.name()), reason, detail),
    );
  }

  // 承認済み写像——alpha 置換の門（裁定 10）。
  attributeMappings(): AttributeMappings {
    return this.#mappings;
  }

  gaps(): DesignFindings {
    return this.#gaps;
  }

  // 正準順（TargetIdentifier.compareTo）の被覆分類——SMT クエリ構築・skip 記録の凍結順。
  sortedObligationStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#obligationStatus]
      .map(([id, st]) => [id.asString(), st] as const)
      .sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])));
  }

  sortedScenarioStatuses(): readonly (readonly [string, RefinementStatus])[] {
    return [...this.#scenarioStatus]
      .map(([id, st]) => [id.asString(), st] as const)
      .sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])));
  }

  statusOfObligation(id: string): RefinementStatus | undefined {
    return this.#obligationStatus.get(ObligationIdentifier.of(id));
  }

  statusOfScenario(id: string): RefinementStatus | undefined {
    return this.#scenarioStatus.get(ScenarioIdentifier.of(id));
  }

  mappedTransitionsOf(reqId: string): readonly TransitionReference[] {
    return this.#eventTransitions.get(ObligationIdentifier.of(reqId)) ?? [];
  }

  // SMT パスの被覆 skip：waived/capability のみ（旧 smtRefinementStatusSkips）。
  smtStatusSkips(unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    for (const [id, st] of this.sortedObligationStatuses()) {
      const s = st.skipFor(TargetIdentifier.of(id), unitName);
      if (s !== null) skipped.push(s);
    }
    for (const [id, st] of this.sortedScenarioStatuses()) {
      const s = st.skipFor(TargetIdentifier.of(id), unitName);
      if (s !== null) skipped.push(s);
    }
    return DesignSkips.of(skipped);
  }

  // Quint パスの被覆 skip：さらに checkable の event 義務・シナリオを
  // 「SMT 専用検査」の capability として記録（旧 quintRefinementStatusSkips。
  // 走査順は旧実装どおり素の辞書順——正準順ではない凍結挙動）。
  quintStatusSkips(req: RefinementRequirements, unitName: string): DesignSkips {
    const skipped: DesignSkipped[] = [];
    for (const [rid, st] of [...this.#obligationStatus]
      .map(([id, status]) => [id.asString(), status] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const s = st.skipFor(TargetIdentifier.of(rid), unitName);
      if (s !== null) skipped.push(s);
      else if (st.isCheckable()) {
        const ob = req.obligationById(rid);
        if (ob?.isEvent()) {
          skipped.push(
            DesignSkipped.of({
              target: TargetIdentifier.of(rid),
              reason: SkipReason.capability(),
              unit: UnitName.of(unitName),
              detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1",
            }),
          );
        } else if (ob?.isInvariantLike()) {
          const assertion = ob.assertion();
          if (assertion === undefined) continue;
          // alpha 置換の失敗を Quint 文書にも記録する（凍結解除 #38 項 1——
          // 旧挙動は義務が痕跡なく落ち、SMT 側だけが報告していた）。文言は
          // SMT 側の compile-error skip と逐語で対。
          const substituted = this.#mappings.substitute(assertion, false);
          if (!substituted.ok) skipped.push(substituted.error.asCompileErrorSkip(TargetIdentifier.of(rid), unitName));
        }
      }
    }
    for (const [rid, st] of [...this.#scenarioStatus]
      .map(([id, status]) => [id.asString(), status] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const s = st.skipFor(TargetIdentifier.of(rid), unitName);
      if (s !== null) skipped.push(s);
      else if (st.isCheckable()) {
        skipped.push(
          DesignSkipped.of({
            target: TargetIdentifier.of(rid),
            reason: SkipReason.capability(),
            unit: UnitName.of(unitName),
            detail:
              "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)",
          }),
        );
      }
    }
    return DesignSkips.of(skipped);
  }

  // Quint 側の refinement 追加不変量：checkable な invariant/numeric ごとの
  // alpha(P)（旧 refinementQuintInvariants）。
  quintInvariants(req: RefinementRequirements): RefinementQuintInvariants {
    const out = req
      .obligations()
      .sortedCanonically()
      .foldLeft<RefinementQuintInvariant[]>([], (acc, ob) => {
        if (!this.#obligationStatus.get(ob.id())?.isCheckable()) return acc;
        const assertion = ob.assertion();
        if (!ob.isInvariantLike() || assertion === undefined) return acc;
        const substituted = this.#mappings.substitute(assertion, false);
        // 欠陥は quintStatusSkips が compile-error skip として記録する（SMT 側と対）。
        if (substituted.ok)
          acc.push(RefinementQuintInvariant.of(ob.id(), ob.functionalRequirementReferences(), substituted.value));
        return acc;
      });
    return RefinementQuintInvariants.of(out);
  }
}
