// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。直列化（v1 キー順・描画）はアダプタの serializer が持つ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import { ContentHash, IrVersion, idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

export const SUPPORTED_IR_MAJOR = 1;

export interface CrossCheckedEntry {
  readonly backend: string;
  readonly targets: string[];
}

// クロスチェック判定表のファーストクラスコレクション。
export class CrossCheckedEntries {
  readonly #values: readonly CrossCheckedEntry[];

  private constructor(values: readonly CrossCheckedEntry[]) {
    this.#values = values;
  }

  static of(values: readonly CrossCheckedEntry[]): CrossCheckedEntries {
    return new CrossCheckedEntries([...values]);
  }

  add(value: CrossCheckedEntry): CrossCheckedEntries {
    return new CrossCheckedEntries([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<CrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly CrossCheckedEntry[] {
    return this.#values;
  }
}

export interface VerificationReportSeed {
  readonly id: VerificationReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: VerificationFindings;
  readonly skipped: VerificationSkips;
  readonly crossChecked: CrossCheckedEntries | null;
  readonly unavailableReason: string | null;
}

export interface VerificationReportComposition {
  readonly id: VerificationReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: VerificationFindings;
  readonly skipped: VerificationSkips;
  readonly crossChecked?: CrossCheckedEntries;
  readonly unavailableReason?: string;
}

export class VerificationReport {
  readonly #id: VerificationReportId;
  readonly #irVersion: IrVersion;
  readonly #irHash: ContentHash;
  readonly #method: string;
  readonly #findings: VerificationFindings;
  readonly #skipped: VerificationSkips;
  readonly #crossChecked: CrossCheckedEntries | null;
  readonly #unavailableReason: string | null;

  private constructor(seed: VerificationReportSeed) {
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
      skipped: VerificationSkips.of(model.allTargets().map((t) => ({
        target: t,
        reason: "ir-version-mismatch",
        detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      }))),
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
        ...model
          .allTargets()
          .filter((t) => !planSkipped.toArray().some((s) => s.target === t))
          .map((t) => ({ target: t, reason: "unavailable", detail: "z3 could not be executed" })),
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
      skipped: VerificationSkips.of(model.allTargets().map((t) => ({ target: t, reason: "unavailable", detail: "quint CLI missing" }))),
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
        ...model.obligations().toArray().map((ob) => ({ target: ob.id, reason: "compile-error", detail: machineError })),
        ...model.scenarios().toArray().map((sc) => ({ target: sc.id, reason: "compile-error", detail: machineError })),
      ]),
    });
  }

  static compose(input: VerificationReportComposition): VerificationReport {
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
  static reconstitute(seed: VerificationReportSeed): VerificationReport {
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

// 兄弟文書のファーストクラスコレクション（クロスチェックの入力）。
export class VerificationReports {
  readonly #values: readonly VerificationReport[];

  private constructor(values: readonly VerificationReport[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationReport[]): VerificationReports {
    return new VerificationReports([...values]);
  }

  add(value: VerificationReport): VerificationReports {
    return new VerificationReports([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<VerificationReport> {
    yield* this.#values;
  }

  toArray(): readonly VerificationReport[] {
    return this.#values;
  }
  // クロスチェック — 同一 irHash の全バックエンド文書から、両者が判定した
  // シナリオの合意/不一致を計算して cross-check レポートを組む（不一致は
  // 「形式化かバックエンドコンパイラの欠陥」であり要件の欠陥ではない——
  // detail 文言は golden 凍結。全書き手がこれを再計算して収束するため、結果は
  // センサーの発火順に依存しない）。旧 crossCheckReport の逐語移植（成立文書の
  // 選別のうち、読めないファイルの黙殺は Repository 側）。
  crossChecked(id: VerificationReportId, model: RequirementsModel, irHash: ContentHash): VerificationReport {
    // 比較に参加するのは同一 irHash の可用文書のみ（旧実装の読込時選別と同値）。
    const docs = this.toArray()
      .filter((s) => s.irHash().equals(irHash) && !s.isUnavailable())
      .map((s) => ({
        backend: s.id().backendName(),
        findings: s.findings().toArray(),
        skippedTargets: new Set(
          s
            .skipped()
            .toArray()
            .filter((e) => typeof e.target === "string")
            .map((e) => e.target),
        ),
      }));

    const scenarioById = new Map(model.scenarios().toArray().map((s) => [s.id, s]));
    const findings: VerificationFinding[] = [];
    const comparedByBackend = new Map<string, Set<string>>();
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (!a || !b) continue;
        for (const sc of model.scenarios()) {
          if (a.skippedTargets.has(sc.id) || b.skippedTargets.has(sc.id)) continue;
          const va = a.findings.some((f) => f.kind === "scenario-violation" && f.targets.includes(sc.id));
          const vb = b.findings.some((f) => f.kind === "scenario-violation" && f.targets.includes(sc.id));
          (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(sc.id);
          (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(sc.id);
          if (va !== vb) {
            const verdicts: { [backend: string]: "violated" | "clean" } = {};
            verdicts[a.backend] = va ? "violated" : "clean";
            verdicts[b.backend] = vb ? "violated" : "clean";
            findings.push({
              kind: "cross-check-disagreement",
              frRefs: sortedUnique([...(scenarioById.get(sc.id)?.frRefs.toArray() ?? [])], idCompare),
              targets: [sc.id],
              witness: { verdicts },
              detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`,
            });
          }
        }
      }
    }
    const crossChecked: CrossCheckedEntry[] = [...comparedByBackend.entries()]
      .map(([backend, targets]) => ({ backend, targets: [...targets].sort(idCompare) }))
      .sort((x, y) => (x.backend < y.backend ? -1 : x.backend > y.backend ? 1 : 0));

    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of([]),
      crossChecked: CrossCheckedEntries.of(crossChecked),
    });
  }

}
