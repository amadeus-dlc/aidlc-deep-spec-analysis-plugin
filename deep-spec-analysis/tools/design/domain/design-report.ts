// DesignReport 集約 — 設計バックエンド（smt / quint / cross-check）の検証結果
// 文書（契約2 拡張：unit 帰属つき finding・inputs/checked 任意）のドメイン表現。
// compose が正準ソート（findings/skipped の設計順・inputs の artifact 順・
// checked の sortedUnique）を不変条件として一度だけ適用する。直列化（キー順・
// 描画）はアダプタの serializer が持つ。degraded は契約適合の降格形
// （findings/skipped/inputs/checked/crossChecked を空にして unavailable 理由
// だけ残す——旧 writeDesignDoc の自己検証降格と同じ姿）。

import type { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { DesignFinding, DesignSkipped } from "./design-finding.ts";
import { sortDesignFindings, sortDesignSkipped } from "./design-finding-order.ts";
import type { DesignReportId } from "./design-report-id.ts";

// 入力成果物の錨（refcheck の InputAnchor と同語彙・コンテキスト所有）。
export interface DesignInputAnchor {
  readonly artifact: string;
  readonly sha256: ContentHash;
}

export interface DesignCrossCheckedEntry {
  readonly backend: string;
  readonly targets: string[];
}

export interface DesignReportSeed {
  readonly id: DesignReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: readonly DesignFinding[];
  readonly skipped: readonly DesignSkipped[];
  readonly inputs: readonly DesignInputAnchor[] | null;
  readonly checked: readonly string[] | null;
  readonly crossChecked: readonly DesignCrossCheckedEntry[] | null;
  readonly unavailableReason: string | null;
}

export interface DesignReportComposition {
  readonly id: DesignReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: readonly DesignFinding[];
  readonly skipped: readonly DesignSkipped[];
  readonly inputs?: readonly DesignInputAnchor[];
  readonly checked?: readonly string[];
  readonly crossChecked?: readonly DesignCrossCheckedEntry[];
  readonly unavailableReason?: string;
}

export class DesignReport {
  readonly #id: DesignReportId;
  readonly #irVersion: IrVersion;
  readonly #irHash: ContentHash;
  readonly #method: string;
  readonly #findings: readonly DesignFinding[];
  readonly #skipped: readonly DesignSkipped[];
  readonly #inputs: readonly DesignInputAnchor[] | null;
  readonly #checked: readonly string[] | null;
  readonly #crossChecked: readonly DesignCrossCheckedEntry[] | null;
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
  static compose(input: DesignReportComposition): DesignReport {
    return new DesignReport({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: input.method,
      findings: sortDesignFindings(input.findings),
      skipped: sortDesignSkipped(input.skipped),
      inputs: input.inputs === undefined ? null : [...input.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0)),
      checked: input.checked === undefined ? null : sortedUnique([...input.checked], idCompare),
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
      findings: [],
      skipped: [],
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

  findings(): readonly DesignFinding[] {
    return this.#findings;
  }

  skipped(): readonly DesignSkipped[] {
    return this.#skipped;
  }

  inputs(): readonly DesignInputAnchor[] | null {
    return this.#inputs;
  }

  checked(): readonly string[] | null {
    return this.#checked;
  }

  crossChecked(): readonly DesignCrossCheckedEntry[] | null {
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
    return this.#unavailableReason === null && this.#findings.length === 0;
  }

  findingsCount(): number {
    return this.#findings.length;
  }

  skippedCount(): number {
    return this.#skipped.length;
  }
}
