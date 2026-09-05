import {
  ContentHash,
  type FindingsSchema,
  IntermediateRepresentationVersion,
  SkipReason,
  VerificationMethod,
} from "@deep-spec/kernel-domain";

// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。文書のキー順は契約2 の知識なので集約が `toDocument()` で
// 所有し、アダプタの serializer が持つのは描画（JSON.stringify）だけ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import type { Json } from "@deep-spec/kernel-infrastructure";
import type { CrossCheckedEntries } from "./cross-checked-entries.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { VerificationFindings } from "./verification-findings.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";
import { VerificationSkipped } from "./verification-skipped.ts";
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
      skipped: VerificationSkips.of(
        [...model.allTargets()].map((t) =>
          VerificationSkipped.of({
            target: t,
            reason: SkipReason.of("ir-version-mismatch"),
            detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
          }),
        ),
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
      skipped: VerificationSkips.of([
        ...planSkipped.toArray(),
        ...[...model.allTargets()]
          .filter((t) => !planSkipped.toArray().some((s) => s.isFor(t)))
          .map((t) =>
            VerificationSkipped.of({
              target: t,
              reason: SkipReason.of("unavailable"),
              detail: "z3 could not be executed",
            }),
          ),
      ]),
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
      skipped: VerificationSkips.of(
        [...model.allTargets()].map((t) =>
          VerificationSkipped.of({ target: t, reason: SkipReason.of("unavailable"), detail: "quint CLI missing" }),
        ),
      ),
      unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)",
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
      skipped: VerificationSkips.of([
        ...model
          .obligations()
          .toArray()
          .map((ob) =>
            VerificationSkipped.of({
              target: ob.id().asTargetId(),
              reason: SkipReason.of("compile-error"),
              detail: machineError,
            }),
          ),
        ...model
          .scenarios()
          .toArray()
          .map((sc) =>
            VerificationSkipped.of({
              target: sc.id().asTargetId(),
              reason: SkipReason.of("compile-error"),
              detail: machineError,
            }),
          ),
      ]),
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
    // コレクションは境界（描画）で toArray() へ落とす——中身は契約2 の素の JSON
    // 形。キー順は旧構築サイトの挿入順そのもの（golden バイト凍結）：finding は
    // (kind, frRefs, targets, witness, detail)、skip は (target, reason,
    // detail?)。witness ユニオンの内側は素通し値（材料）で逐語描画。
    ordered.findings = this.#findings.toArray().map((f) => {
      const out: { [k: string]: Json } = {
        kind: f.kind(),
        frRefs: f.functionalRequirementReferences().toStrings() as unknown as Json,
        targets: f.targets().toStrings() as unknown as Json,
        witness: f.witness().toDocument() as unknown as Json,
        detail: f.detail(),
      };
      return out as Json;
    });
    ordered.skipped = this.#skipped.toArray().map((sk) => {
      const out: { [k: string]: Json } = { target: sk.target().asString(), reason: sk.reason() };
      const detail = sk.detail();
      if (detail !== undefined) out.detail = detail;
      return out as Json;
    });
    const crossChecked = this.#crossChecked;
    // crossChecked エントリの凍結キー順は (backend, targets)。
    if (crossChecked !== null) {
      ordered.crossChecked = crossChecked
        .toArray()
        .map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }) as unknown as Json);
    }
    return ordered;
  }

  // 契約2 への適合を保証した集約を返す。適合していれば自分自身、していなければ
  // 降格形（文言は FindingsSchema が凍結で所有する）。
  conformedTo(schema: FindingsSchema): VerificationReport {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
