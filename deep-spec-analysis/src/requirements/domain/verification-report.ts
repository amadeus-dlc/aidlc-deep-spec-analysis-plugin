import {
  ContentHash,
  type ErrorMessage,
  type FindingsSchema,
  IntermediateRepresentationVersion,
  ScenarioVerdict,
  SkipReason,
  type TargetIdentifier,
  VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";

// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。文書のキー順は契約2 の知識なので集約が `toDocument()` で
// 所有し、アダプタの serializer が持つのは描画（JSON.stringify）だけ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import {
  combinedHash,
  hashOfNullable,
  hashOfString,
  type Json,
  type ParseError,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { CrossCheckedEntries } from "./cross-checked-entries.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { VerificationFindings } from "./verification-findings.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";
import { VerificationSkips } from "./verification-skips.ts";

export const SUPPORTED_IR_MAJOR = 1;

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type VerificationReportParam = {
  readonly id: VerificationReportIdentifier;
  readonly irVersion: IntermediateRepresentationVersion;
  readonly irHash: ContentHash;
  readonly method: VerificationMethod;
  readonly findings: VerificationFindings;
  readonly skipped: VerificationSkips;
  readonly crossChecked: CrossCheckedEntries | null;
  readonly unavailableReason: string | null;
};

export class VerificationReport {
  readonly #id: VerificationReportIdentifier;
  readonly #irVersion: IntermediateRepresentationVersion;
  readonly #irHash: ContentHash;
  readonly #method: VerificationMethod;
  readonly #findings: VerificationFindings;
  readonly #skipped: VerificationSkips;
  readonly #crossChecked: CrossCheckedEntries | null;
  readonly #unavailableReason: string | null;

  private constructor(seed: VerificationReportParam) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#irHash = seed.irHash;
    this.#method = seed.method;
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }

  // ---- 降格レポートの static ファクトリ（OOUI 裁定・文言は golden 凍結） ----

  // IR が読めない（fence 不正・JSON 不正・構造不正）。irVersion "0.0.0" と
  // 空文字列の sha256 が「モデル不在」の凍結表現。
  static irUnreadable(id: VerificationReportIdentifier, method: string, cause: string): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      unavailableReason: `IR unreadable: ${cause} — see the deep-spec-ir-valid sensor for details`,
    });
  }

  // IR の major がこのバックエンドの対応外——全対象を skip として記録する。
  static versionMismatch(
    id: VerificationReportIdentifier,
    model: RequirementsModel,
    method: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(
        model.allTargets(),
        SkipReason.of("ir-version-mismatch"),
        `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      ),
    });
  }

  // SMT バックエンド固有：ソルバ実行不能。コンパイル時 skip を保ちつつ、
  // 残る全対象を unavailable として記録する。
  static solverUnavailable(
    id: VerificationReportIdentifier,
    model: RequirementsModel,
    planSkipped: VerificationSkips,
    reason: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "exhaustive",
      findings: VerificationFindings.of([]),
      skipped: planSkipped.combine(
        VerificationSkips.coveringAll(
          model.allTargets().filter((t) => !planSkipped.exists((s) => s.isFor(t))),
          SkipReason.of("unavailable"),
          "z3 could not be executed",
        ),
      ),
      unavailableReason: reason,
    });
  }

  // Quint バックエンド固有：CLI 不在（method "simulation" 固定）。
  static quintUnavailable(id: VerificationReportIdentifier, model: RequirementsModel): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("unavailable"), "quint CLI missing"),
      unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)",
    });
  }

  // Quint の実行環境を調べる I/O に失敗した。CLI 不在（実行能力の欠如）や
  // 機械のコンパイル不能とは異なり、原因を unavailable 理由へ残す。
  static quintBackendUnavailable(
    id: VerificationReportIdentifier,
    model: RequirementsModel,
    reason: ErrorMessage,
  ): VerificationReport {
    const detail = `quint backend unavailable: ${reason.asString()}`;
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("unavailable"), detail),
      unavailableReason: detail,
    });
  }

  // Quint バックエンド固有：機械コンパイル不能（非有界 int・変数名衝突）。
  static machineUncompilable(
    id: VerificationReportIdentifier,
    model: RequirementsModel,
    method: string,
    machineError: string,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: VerificationFindings.of([]),
      // 対象は義務 id ＋シナリオ id の全体（compose が正準順へ整える）。
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("compile-error"), machineError),
    });
  }

  // 検査結果の並びを正準化してから、共通の生成口へ渡す。
  static compose(input: {
    readonly id: VerificationReportIdentifier;
    readonly irVersion: IntermediateRepresentationVersion;
    readonly irHash: ContentHash;
    readonly method: string;
    readonly findings: VerificationFindings;
    readonly skipped: VerificationSkips;
    readonly crossChecked?: CrossCheckedEntries;
    readonly unavailableReason?: string;
  }): VerificationReport {
    return VerificationReport.of({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: VerificationMethod.of(input.method),
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null,
    });
  }

  static interpretationUnavailable(
    id: VerificationReportIdentifier,
    model: RequirementsModel,
    method: VerificationMethod,
    error: ParseError,
  ): VerificationReport {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: method.asString(),
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      unavailableReason: `verification evidence could not be represented: ${JSON.stringify(error)}`,
    });
  }

  // 型付きの文書を、要素の並びを保持して構築する。
  static of(seed: VerificationReportParam): VerificationReport {
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

  scenarioVerdictFor(target: TargetIdentifier, irHash: ContentHash): ScenarioVerdict {
    const backend = this.#id.backendName();
    if (!this.#irHash.equals(irHash) || this.isUnavailable())
      return ScenarioVerdict.unavailable(backend, this.#irHash, target, null);
    if (this.#skipped.exists((skip) => skip.isFor(target)))
      return ScenarioVerdict.skipped(backend, this.#irHash, target, null);
    if (this.#findings.exists((finding) => finding.isKind("scenario-violation") && finding.implicates(target)))
      return ScenarioVerdict.violated(backend, this.#irHash, target, null);
    return ScenarioVerdict.clean(backend, this.#irHash, target, null);
  }

  id(): VerificationReportIdentifier {
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

  findings(): VerificationFindings {
    return this.#findings;
  }

  skipped(): VerificationSkips {
    return this.#skipped;
  }

  crossChecked(): CrossCheckedEntries | null {
    return this.#crossChecked;
  }

  equals(other: VerificationReport): boolean {
    const crossCheckedEqual =
      this.#crossChecked === null
        ? other.#crossChecked === null
        : other.#crossChecked !== null && this.#crossChecked.equals(other.#crossChecked);
    return (
      this.#id.equals(other.#id) &&
      this.#irVersion.equals(other.#irVersion) &&
      this.#irHash.equals(other.#irHash) &&
      this.#method.equals(other.#method) &&
      this.#findings.equals(other.#findings) &&
      this.#skipped.equals(other.#skipped) &&
      crossCheckedEqual &&
      this.#unavailableReason === other.#unavailableReason
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#id.hashCode(),
      this.#irVersion.hashCode(),
      this.#irHash.hashCode(),
      this.#method.hashCode(),
      this.#findings.hashCode(),
      this.#skipped.hashCode(),
      hashOfNullable(this.#crossChecked, (entries) => entries.hashCode()),
      hashOfNullable(this.#unavailableReason, hashOfString),
    ]);
  }

  unavailableReason(): string | null {
    return this.#unavailableReason;
  }

  isUnavailable(): boolean {
    return this.#unavailableReason !== null;
  }

  // 判定できなかったレポートを、診断がないことだけで成功扱いしない。
  passes(): boolean {
    return !this.isUnavailable() && this.#findings.isEmpty();
  }

  findingsCount(): number {
    return this.#findings.count();
  }

  skippedCount(): number {
    return this.#skipped.count();
  }

  // 契約2 の文書像。v1 キー順（backend, irVersion, irHash, method,
  // [unavailable], findings, skipped, [crossChecked]）は契約の知識なので集約が
  // 所有する——アダプタは JSON.stringify で描画するだけ（golden 凍結）。
  toDocument(): { [k: string]: Json } {
    const ordered: { [k: string]: Json } = {
      backend: this.#id.backendName().asString(),
      irVersion: this.#irVersion.asString(),
      irHash: this.#irHash.asString(),
      method: this.method(),
    };
    const reason = this.#unavailableReason;
    if (reason !== null) ordered.unavailable = { reason };
    // 要素 1 件の文書像とその凍結キー順は、それぞれのコレクションが所有する。
    ordered.findings = this.#findings.toDocuments();
    ordered.skipped = this.#skipped.toDocuments();
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null) ordered.crossChecked = crossChecked.toDocuments();
    return ordered;
  }

  // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
  // 降格形（文言は FindingsSchema が凍結で所有する）。
  conformedTo(schema: FindingsSchema): VerificationReport {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
