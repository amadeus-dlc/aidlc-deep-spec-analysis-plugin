import {
  ContentHash,
  type FindingsSchema,
  IntermediateRepresentationVersion,
  ScenarioVerdict,
  SkipReason,
  type TargetIdentifier,
  UnitName,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";

// DesignReport 集約 — 設計バックエンド（smt / quint / cross-check）の検証結果
// 文書（契約2 拡張：unit 帰属つき finding・inputs/checked 任意）のドメイン表現。
// compose が正準ソート（findings/skipped の設計順・inputs の artifact 順・
// checked の sortedUnique）を適用する。文書のキー順は集約が、
// JSON文字列への描画はアダプタの serializer が持つ。degraded は契約適合の降格形
// （findings/skipped/inputs/checked/crossChecked を空にして unavailable 理由
// だけ残す——旧 writeDesignDoc の自己検証降格と同じ姿）。

import type { Json, ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import { CheckedUnits } from "./checked-units.ts";
import type { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignInputAnchors } from "./design-input-anchors.ts";
import type { DesignModel } from "./design-model.ts";
import type { DesignReportIdentifier } from "./design-report-identifier.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignUnit } from "./design-unit.ts";
import type { LoweredUnit } from "./lowered-unit.ts";
import { ReachabilityPlan } from "./reachability-plan.ts";

export const SUPPORTED_DESIGN_IR_MAJOR = 1;

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignReportParam = {
  readonly id: DesignReportIdentifier;
  readonly irVersion: IntermediateRepresentationVersion;
  readonly irHash: ContentHash;
  readonly method: VerificationMethod;
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  readonly inputs: DesignInputAnchors | null;
  readonly checked: CheckedUnits | null;
  readonly crossChecked: DesignCrossCheckedEntries | null;
  readonly unavailableReason: string | null;
};

export class DesignReport {
  readonly #id: DesignReportIdentifier;
  readonly #irVersion: IntermediateRepresentationVersion;
  readonly #irHash: ContentHash;
  readonly #method: VerificationMethod;
  readonly #findings: DesignFindings;
  readonly #skipped: DesignSkips;
  readonly #inputs: DesignInputAnchors | null;
  readonly #checked: CheckedUnits | null;
  readonly #crossChecked: DesignCrossCheckedEntries | null;
  readonly #unavailableReason: string | null;

  private constructor(seed: DesignReportParam) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#irHash = seed.irHash;
    this.#method = seed.method;
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#inputs = seed.inputs;
    this.#checked = seed.checked;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }

  static started(id: DesignReportIdentifier, model: DesignModel, method: VerificationMethod): DesignReport {
    return DesignReport.of({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      checked: CheckedUnits.of([]),
      inputs: null,
      crossChecked: null,
      unavailableReason: null,
    });
  }

  equals(other: DesignReport): boolean {
    return this.#id.equals(other.#id);
  }

  hashCode(): number {
    return this.#id.hashCode();
  }

  #revised(changes: Partial<DesignReportParam>): DesignReport {
    return new DesignReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: this.#findings,
      skipped: this.#skipped,
      checked: this.#checked,
      inputs: this.#inputs,
      crossChecked: this.#crossChecked,
      unavailableReason: this.#unavailableReason,
      ...changes,
    });
  }

  withEvidence(findings: DesignFindings, skipped: DesignSkips): DesignReport {
    return this.#revised({
      findings: this.#findings.combine(findings).sortedCanonically(),
      skipped: this.#skipped.concat(skipped).sortedCanonically(),
    });
  }

  withInputs(inputs: DesignInputAnchors): DesignReport {
    return this.#revised({ inputs: inputs.sortedByArtifact() });
  }

  loweringFailed(unit: DesignUnit, error: ParseError): DesignReport {
    return this.unitUnverified(unit, SkipReason.compileError(), `design lowering failed: ${error.kind}`);
  }

  unitTimedOut(unit: DesignUnit): DesignReport {
    const backend = this.#id.backendName().asString() === "smt" ? "solver" : "backend";
    return this.unitUnverified(
      unit,
      SkipReason.timeout(),
      `the per-run ${backend} budget was exhausted before this unit`,
    );
  }

  unitUnverified(unit: DesignUnit, reason: SkipReason, detail: string): DesignReport {
    return this.withEvidence(
      DesignFindings.of([]),
      DesignSkips.forTargets(unit.allTargets(), UnitName.of(unit.name()), reason, detail),
    );
  }

  unitVerified(unit: DesignUnit, findings: DesignFindings, skipped: DesignSkips, method: string): DesignReport {
    const checked = this.#checked ?? CheckedUnits.of([]);
    const firstQuintUnit = this.#id.backendName().asString() === "quint" && checked.isEmpty();
    return this.withEvidence(findings, skipped).#revised({
      method: firstQuintUnit ? VerificationMethod.of(method) : this.#method,
      checked: checked.add(UnitName.of(`unit:${unit.name()}`)).sortedUniqueCanonically(),
    });
  }

  backendFailed(model: DesignModel, reason: string): DesignReport {
    const detail = this.#id.backendName().asString() === "smt" ? "z3 could not be executed" : "quint CLI missing";
    return DesignReport.backendUnavailable(this.#id, model, this.#irHash, this.#method.asString(), reason, detail);
  }

  planReachability(unit: DesignUnit, lowered: LoweredUnit): ReachabilityPlan {
    return ReachabilityPlan.forUnit(unit, lowered, this.#method);
  }

  refinementUnavailable(path: string, kind: string): DesignReport {
    return this.#revised({ unavailableReason: `refinement input could not be acquired: ${path} (${kind})` });
  }

  // ---- 降格レポートの static ファクトリ（OOUI 裁定・文言は golden 凍結） ----

  // 設計 IR が読めない（fence 不正・JSON 不正・構造不正）。
  static irUnreadable(id: DesignReportIdentifier, method: VerificationMethod, cause: string): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method: method.asString(),
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      unavailableReason: `design IR unreadable: ${cause} — see the deep-spec-design-ir-valid sensor for details`,
    });
  }

  // 設計 IR の major がこのバックエンドの対応外——全ユニットの全対象を skip。
  static versionMismatch(
    id: DesignReportIdentifier,
    model: DesignModel,
    irHash: ContentHash,
    method: string,
  ): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: model
        .units()
        .allTargetsSkipped(
          SkipReason.irVersionMismatch(),
          `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
        ),
    });
  }

  // lowered v1 バックエンドが 127 を返した——全ユニットの全対象を unavailable
  // として記録する（skipDetail は backend 固有の凍結語彙：smt "z3 could not be
  // executed" / quint "quint CLI missing"）。
  static backendUnavailable(
    id: DesignReportIdentifier,
    model: DesignModel,
    irHash: ContentHash,
    method: string,
    reason: string,
    skipDetail: string,
  ): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: model.units().allTargetsSkipped(SkipReason.unavailable(), skipDetail),
      unavailableReason: reason,
    });
  }

  // 検査結果の並びを正準化してから、共通の生成口へ渡す。
  static compose(input: {
    readonly id: DesignReportIdentifier;
    readonly irVersion: IntermediateRepresentationVersion;
    readonly irHash: ContentHash;
    readonly method: string;
    readonly findings: DesignFindings;
    readonly skipped: DesignSkips;
    readonly inputs?: DesignInputAnchors;
    readonly checked?: CheckedUnits;
    readonly crossChecked?: DesignCrossCheckedEntries;
    readonly unavailableReason?: string;
  }): DesignReport {
    return DesignReport.of({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: VerificationMethod.of(input.method),
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      inputs: input.inputs === undefined ? null : input.inputs.sortedByArtifact(),
      checked: input.checked === undefined ? null : input.checked.sortedUniqueCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null,
    });
  }

  // 型付きの文書を、要素の並びを保持して構築する。
  static of(seed: DesignReportParam): DesignReport {
    return new DesignReport(seed);
  }

  // 契約適合の降格形。識別・irVersion・irHash・method は保ち、内容を空にして
  // unavailable 理由だけを残す。
  degraded(reason: string): DesignReport {
    return new DesignReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      inputs: null,
      checked: null,
      crossChecked: null,
      unavailableReason: reason,
    });
  }

  scenarioVerdictFor(unit: UnitName, target: TargetIdentifier, irHash: ContentHash): ScenarioVerdict {
    const backend = this.#id.backendName();
    if (!this.#irHash.equals(irHash) || this.isUnavailable())
      return ScenarioVerdict.unavailable(backend, this.#irHash, target, unit);
    if (this.#skipped.exists((skip) => skip.appliesTo(unit, target)))
      return ScenarioVerdict.skipped(backend, this.#irHash, target, unit);
    if (this.#findings.exists((finding) => finding.violatesScenario(unit, target)))
      return ScenarioVerdict.violated(backend, this.#irHash, target, unit);
    return ScenarioVerdict.clean(backend, this.#irHash, target, unit);
  }

  id(): DesignReportIdentifier {
    return this.#id;
  }

  irVersion(): IntermediateRepresentationVersion {
    return this.#irVersion;
  }

  irHash(): ContentHash {
    return this.#irHash;
  }

  method(): string {
    return this.#method.asString();
  }

  findings(): DesignFindings {
    return this.#findings;
  }

  skipped(): DesignSkips {
    return this.#skipped;
  }

  inputs(): DesignInputAnchors | null {
    return this.#inputs;
  }

  checked(): CheckedUnits | null {
    return this.#checked;
  }

  crossChecked(): DesignCrossCheckedEntries | null {
    return this.#crossChecked;
  }

  unavailableReason(): string | null {
    return this.#unavailableReason;
  }

  isUnavailable(): boolean {
    return this.#unavailableReason !== null;
  }

  // verdict 行の pass はこの述語から導く（unavailable でなく findings ゼロ）。
  passes(): boolean {
    return this.#unavailableReason === null && this.#findings.isEmpty();
  }

  findingsCount(): number {
    return this.#findings.count();
  }

  skippedCount(): number {
    return this.#skipped.count();
  }

  // 契約2 の文書像。キー順（backend, irVersion, irHash, method, [unavailable],
  // [inputs], [checked], findings, skipped, [crossChecked]）は契約の知識なので
  // 集約が所有する——アダプタは JSON.stringify で描画するだけ（golden 凍結）。
  toDocument(): { [k: string]: Json } {
    const ordered: { [k: string]: Json } = {
      backend: this.#id.backendName().asString(),
      irVersion: this.#irVersion.asString(),
      irHash: this.#irHash.asString(),
      method: this.method(),
    };
    const reason = this.#unavailableReason;
    if (reason !== null) ordered.unavailable = { reason };
    const inputs = this.#inputs;
    // ContentHash は境界（描画）で asString() へ落とす（キー順は旧挿入順）。
    if (inputs !== null) ordered.inputs = inputs.toDocuments();
    const checked = this.#checked;
    if (checked !== null) ordered.checked = checked.toStrings() as unknown as Json;
    // ペイロードのコレクションは自分の文書像を自分で知っている。キー順は旧構築
    // サイトの挿入順そのもの（golden バイト凍結）：finding は (kind, frRefs,
    // targets, witness, unit, detail)、skip は (target, reason, unit, detail?)。
    ordered.findings = this.#findings.toDocuments();
    ordered.skipped = this.#skipped.toDocuments();
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null) ordered.crossChecked = crossChecked.toDocuments();
    return ordered;
  }

  // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
  // 降格形（文言は FindingsSchema が凍結で所有する）。
  conformedTo(schema: FindingsSchema): DesignReport {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
