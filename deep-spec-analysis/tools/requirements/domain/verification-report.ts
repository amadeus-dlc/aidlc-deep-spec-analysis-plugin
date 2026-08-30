// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。直列化（v1 キー順・描画）はアダプタの serializer が持つ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import type { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import type { VerificationReportId } from "./verification-report-id.ts";
import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";

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
}
