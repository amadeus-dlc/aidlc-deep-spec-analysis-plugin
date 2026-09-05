import { UnitName, ContentHash, IntermediateRepresentationVersion, SkipReason, VerificationMethod, type FindingsSchema } from "@deep-spec/kernel-domain";

// DesignReport 集約 — 設計バックエンド（smt / quint / cross-check）の検証結果
// 文書（契約2 拡張：unit 帰属つき finding・inputs/checked 任意）のドメイン表現。
// compose が正準ソート（findings/skipped の設計順・inputs の artifact 順・
// checked の sortedUnique）を適用する。文書のキー順は集約が、
// JSON文字列への描画はアダプタの serializer が持つ。degraded は契約適合の降格形
// （findings/skipped/inputs/checked/crossChecked を空にして unavailable 理由
// だけ残す——旧 writeDesignDoc の自己検証降格と同じ姿）。

import type { Json } from "@deep-spec/kernel-infrastructure";
import type { DesignModel } from "./design-model.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignReportIdentifier } from "./design-report-identifier.ts";
import { CheckedUnits } from "./checked-units.ts";
import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignInputAnchors } from "./design-input-anchors.ts";

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

  // ---- 降格レポートの static ファクトリ（OOUI 裁定・文言は golden 凍結） ----

  // 設計 IR が読めない（fence 不正・JSON 不正・構造不正）。
  static irUnreadable(id: DesignReportIdentifier, method: string, cause: string): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      unavailableReason: `design IR unreadable: ${cause} — see the deep-spec-design-ir-valid sensor for details`,
    });
  }

  // 設計 IR の major がこのバックエンドの対応外——全ユニットの全対象を skip。
  static versionMismatch(id: DesignReportIdentifier, model: DesignModel, irHash: ContentHash, method: string): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) =>
        [...u.allTargets()].map((t) => (DesignSkipped.of({
          target: t,
          reason: SkipReason.irVersionMismatch(),
          unit: UnitName.of(u.name()),
          detail: `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
        }))),
      )),
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
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) =>
        [...u.allTargets()].map((t) => (DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: skipDetail }))),
      )),
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
    if (inputs !== null) ordered.inputs = inputs.toArray().map((i) => ({ artifact: i.artifact(), sha256: i.sha256().asString() })) as unknown as Json;
    const checked = this.#checked;
    if (checked !== null) ordered.checked = checked.toStrings() as unknown as Json;
    // ペイロードのコレクションはこの描画点でだけ toArray() に降りる。キー順は
    // 旧構築サイトの挿入順そのもの（golden バイト凍結）：finding は (kind,
    // frRefs, targets, witness, unit, detail)、skip は (target, reason, unit,
    // detail?)。witness は DesignWitness が逐語で降りる。
    ordered.findings = this.#findings.toArray().map((f) => {
      const out: { [k: string]: Json } = {
        kind: f.kind(),
        frRefs: f.functionalRequirementReferences().toStrings() as unknown as Json,
        targets: f.targets().toStrings() as unknown as Json,
        witness: f.witness().toDocument() as unknown as Json,
        unit: f.unit(),
        detail: f.detail(),
      };
      return out as Json;
    });
    ordered.skipped = this.#skipped.toArray().map((sk) => {
      const out: { [k: string]: Json } = { target: sk.target().asString(), reason: sk.reason(), unit: sk.unit() };
      const detail = sk.detail();
      if (detail !== undefined) out.detail = detail;
      return out as Json;
    });
    const crossChecked = this.#crossChecked;
    // crossChecked エントリの凍結キー順は (backend, targets)。
    if (crossChecked !== null) {
      ordered.crossChecked = crossChecked.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }) as unknown as Json);
    }
    return ordered;
  }

  // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
  // 降格形（文言は FindingsSchema が凍結で所有する）。
  conformedTo(schema: FindingsSchema): DesignReport {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}

