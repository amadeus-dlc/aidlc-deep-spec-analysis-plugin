// DesignReport 集約 — 設計バックエンド（smt / quint / cross-check）の検証結果
// 文書（契約2 拡張：unit 帰属つき finding・inputs/checked 任意）のドメイン表現。
// compose が正準ソート（findings/skipped の設計順・inputs の artifact 順・
// checked の sortedUnique）を不変条件として一度だけ適用する。直列化（キー順・
// 描画）はアダプタの serializer が持つ。degraded は契約適合の降格形
// （findings/skipped/inputs/checked/crossChecked を空にして unavailable 理由
// だけ残す——旧 writeDesignDoc の自己検証降格と同じ姿）。

import { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import type { DesignModel } from "./design-model.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkips } from "./design-skips.ts";
import type { DesignReportId } from "./design-report-id.ts";
import { CheckedUnits } from "./checked-units.ts";
import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignInputAnchors } from "./design-input-anchors.ts";
import type { DesignReportComposition } from "./design-report-composition.ts";
import type { DesignReportSeed } from "./design-report-seed.ts";








export const SUPPORTED_DESIGN_IR_MAJOR = 1;

export class DesignReport {
  readonly #id: DesignReportId;
  readonly #irVersion: IrVersion;
  readonly #irHash: ContentHash;
  readonly #method: string;
  readonly #findings: DesignFindings;
  readonly #skipped: DesignSkips;
  readonly #inputs: DesignInputAnchors | null;
  readonly #checked: CheckedUnits | null;
  readonly #crossChecked: DesignCrossCheckedEntries | null;
  readonly #unavailableReason: string | null;

  private constructor(seed: DesignReportSeed) {
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

  // 検査結果からの組成。正準ソートは集約の不変条件としてここで一度だけ適用する。

  // ---- 降格レポートの static ファクトリ（OOUI 裁定・文言は golden 凍結） ----

  // 設計 IR が読めない（fence 不正・JSON 不正・構造不正）。
  static irUnreadable(id: DesignReportId, method: string, cause: string): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: IrVersion.reconstitute("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      unavailableReason: `design IR unreadable: ${cause} — see the deep-spec-design-ir-valid sensor for details`,
    });
  }

  // 設計 IR の major がこのバックエンドの対応外——全ユニットの全対象を skip。
  static versionMismatch(id: DesignReportId, model: DesignModel, irHash: ContentHash, method: string): DesignReport {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) =>
        [...u.allTargets()].map((t) => ({
          target: t,
          reason: "ir-version-mismatch",
          unit: u.name(),
          detail: `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
        })),
      )),
    });
  }

  // lowered v1 バックエンドが 127 を返した——全ユニットの全対象を unavailable
  // として記録する（skipDetail は backend 固有の凍結語彙：smt "z3 could not be
  // executed" / quint "quint CLI missing"）。
  static backendUnavailable(
    id: DesignReportId,
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
        [...u.allTargets()].map((t) => ({ target: t, reason: "unavailable", unit: u.name(), detail: skipDetail })),
      )),
      unavailableReason: reason,
    });
  }

  static compose(input: DesignReportComposition): DesignReport {
    return new DesignReport({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: input.method,
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      inputs: input.inputs === undefined ? null : input.inputs.sortedByArtifact(),
      checked: input.checked === undefined ? null : input.checked.sortedUniqueCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null,
    });
  }

  // 書かれた文書からの再構成（ソートしない——書かれた姿が正）。
  static reconstitute(seed: DesignReportSeed): DesignReport {
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

  id(): DesignReportId {
    return this.#id;
  }

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  irHash(): ContentHash {
    return this.#irHash;
  }

  method(): string {
    return this.#method;
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
}

