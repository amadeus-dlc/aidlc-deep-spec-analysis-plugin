// VerificationReport 集約 — v1 バックエンド（smt / quint / cross-check）の
// 検証結果文書（契約2）のドメイン表現。compose が正準ソートを所有し、
// 以後この集約は不変。直列化（v1 キー順・描画）はアダプタの serializer が持つ。
// degraded は契約適合の降格形（findings/skipped/crossChecked を空にして
// unavailable 理由だけ残す——旧 writeFindingsDoc の自己検証降格と同じ姿）。

import type { VerificationReportId } from "./verification-report-id.ts";
import type { VerificationFinding, VerificationSkipped } from "./verification-finding.ts";
import { sortVerificationFindings, sortVerificationSkipped } from "./verification-finding-order.ts";

export interface CrossCheckedEntry {
  readonly backend: string;
  readonly targets: string[];
}

export interface VerificationReportSeed {
  readonly id: VerificationReportId;
  readonly irVersion: string;
  readonly irHash: string;
  readonly method: string;
  readonly findings: readonly VerificationFinding[];
  readonly skipped: readonly VerificationSkipped[];
  readonly crossChecked: readonly CrossCheckedEntry[] | null;
  readonly unavailableReason: string | null;
}

export interface VerificationReportComposition {
  readonly id: VerificationReportId;
  readonly irVersion: string;
  readonly irHash: string;
  readonly method: string;
  readonly findings: readonly VerificationFinding[];
  readonly skipped: readonly VerificationSkipped[];
  readonly crossChecked?: readonly CrossCheckedEntry[];
  readonly unavailableReason?: string;
}

export class VerificationReport {
  readonly #id: VerificationReportId;
  readonly #irVersion: string;
  readonly #irHash: string;
  readonly #method: string;
  readonly #findings: readonly VerificationFinding[];
  readonly #skipped: readonly VerificationSkipped[];
  readonly #crossChecked: readonly CrossCheckedEntry[] | null;
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
      findings: sortVerificationFindings(input.findings),
      skipped: sortVerificationSkipped(input.skipped),
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
      findings: [],
      skipped: [],
      crossChecked: null,
      unavailableReason: reason,
    });
  }

  id(): VerificationReportId {
    return this.#id;
  }

  irVersion(): string {
    return this.#irVersion;
  }

  irHash(): string {
    return this.#irHash;
  }

  method(): string {
    return this.#method;
  }

  findings(): readonly VerificationFinding[] {
    return this.#findings;
  }

  skipped(): readonly VerificationSkipped[] {
    return this.#skipped;
  }

  crossChecked(): readonly CrossCheckedEntry[] | null {
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
    return this.#findings.length === 0;
  }

  findingsCount(): number {
    return this.#findings.length;
  }

  skippedCount(): number {
    return this.#skipped.length;
  }
}
