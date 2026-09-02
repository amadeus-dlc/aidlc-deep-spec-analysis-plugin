// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。直列化（v1 キー順・描画）はアダプタの serializer が持つ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { CrossCheckedEntries } from "./cross-checked-entries.ts";

export const SUPPORTED_IR_MAJOR = 1;

export class VerificationReport {
  readonly #id: VerificationReportId;
  readonly #irVersion: IrVersion;
  readonly #irHash: ContentHash;
  readonly #method: string;
  readonly #findings: VerificationFindings;
  readonly #skipped: VerificationSkips;
  readonly #crossChecked: CrossCheckedEntries | null;
  readonly #unavailableReason: string | null;

  private constructor(seed: {
    readonly id: VerificationReportId;
    readonly irVersion: IrVersion;
    readonly irHash: ContentHash;
    readonly method: string;
    readonly findings: VerificationFindings;
    readonly skipped: VerificationSkips;
    readonly crossChecked: CrossCheckedEntries | null;
    readonly unavailableReason: string | null;
  }) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#irHash = seed.irHash;
    this.#method = seed.method;
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }

  // 検査結果からの組成。findings / skipped の正準ソート（kind 順位→targets→
  // detail、target→reason）は集約の不変条件としてここで一度だけ適用する。
  // ---- 降格レポートの static ファクトリ（OOUI 裁定・文言は golden 凍結） ----

  // IR が読めない（fence 不正・JSON 不正・構造不正）。irVersion "0.0.0" と
  // 空文字列の sha256 が「モデル不在」の凍結表現。
  static irUnreadable(id: VerificationReportId, method: string, cause: string): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: IrVersion.reconstitute("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      unavailableReason: `IR unreadable: ${cause} — see the deep-spec-ir-valid sensor for details`,
    });
  }

  // IR の major がこのバックエンドの対応外——全対象を skip として記録する。
  static versionMismatch(
    id: VerificationReportId,
    model: RequirementsModel,
    irHash: ContentHash,
    method: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => (VerificationSkipped.reconstitute({
        target: t,
        reason: "ir-version-mismatch",
        detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      })))),
    });
  }

  // SMT バックエンド固有：ソルバ実行不能。コンパイル時 skip を保ちつつ、
  // 残る全対象を unavailable として記録する。
  static solverUnavailable(
    id: VerificationReportId,
    model: RequirementsModel,
    irHash: ContentHash,
    planSkipped: VerificationSkips,
    reason: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([
        ...planSkipped.toArray(),
        ...[...model.allTargets()]
          .filter((t) => !planSkipped.toArray().some((s) => s.isFor(t)))
          .map((t) => (VerificationSkipped.reconstitute({ target: t, reason: "unavailable", detail: "z3 could not be executed" }))),
      ]),
      unavailableReason: reason,
    });
  }

  // Quint バックエンド固有：CLI 不在（method "simulation" 固定）。
  static quintUnavailable(id: VerificationReportId, model: RequirementsModel, irHash: ContentHash): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => (VerificationSkipped.reconstitute({ target: t, reason: "unavailable", detail: "quint CLI missing" })))),
      unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)",
    });
  }

  // Quint バックエンド固有：機械コンパイル不能（非有界 int・変数名衝突）。
  static machineUncompilable(
    id: VerificationReportId,
    model: RequirementsModel,
    irHash: ContentHash,
    method: string,
    machineError: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([
        ...model.obligations().toArray().map((ob) => (VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: machineError }))),
        ...model.scenarios().toArray().map((sc) => (VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "compile-error", detail: machineError }))),
      ]),
    });
  }

  static compose(input: {
    readonly id: VerificationReportId;
    readonly irVersion: IrVersion;
    readonly irHash: ContentHash;
    readonly method: string;
    readonly findings: VerificationFindings;
    readonly skipped: VerificationSkips;
    readonly crossChecked?: CrossCheckedEntries;
    readonly unavailableReason?: string;
  }): VerificationReport {
    return new VerificationReport({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: input.method,
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null,
    });
  }

  // 書かれた文書からの再構成（ソートしない——書かれた姿が正）。
  static reconstitute(seed: {
    readonly id: VerificationReportId;
    readonly irVersion: IrVersion;
    readonly irHash: ContentHash;
    readonly method: string;
    readonly findings: VerificationFindings;
    readonly skipped: VerificationSkips;
    readonly crossChecked: CrossCheckedEntries | null;
    readonly unavailableReason: string | null;
  }): VerificationReport {
    return new VerificationReport(seed);
  }

  // 契約適合の降格形。識別・irVersion・irHash・method は保ち、内容を空にして
  // unavailable 理由だけを残す。
  degraded(reason: string): VerificationReport {
    return new VerificationReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      crossChecked: null,
      unavailableReason: reason,
    });
  }

  id(): VerificationReportId {
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

  findings(): VerificationFindings {
    return this.#findings;
  }

  skipped(): VerificationSkips {
    return this.#skipped;
  }

  crossChecked(): CrossCheckedEntries | null {
    return this.#crossChecked;
  }

  unavailableReason(): string | null {
    return this.#unavailableReason;
  }

  isUnavailable(): boolean {
    return this.#unavailableReason !== null;
  }

  // verdict 行の pass はこの述語から導く（findings ゼロ＝pass）。
  passes(): boolean {
    return this.#findings.isEmpty();
  }

  findingsCount(): number {
    return this.#findings.count();
  }

  skippedCount(): number {
    return this.#skipped.count();
  }
}
