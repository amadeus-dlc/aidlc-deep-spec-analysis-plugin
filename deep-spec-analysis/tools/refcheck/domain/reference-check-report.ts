// ReferenceCheckReport 集約 — 契約2 の refcheck 文書のドメイン表現。
//
// ドメインは型付きの語彙（findings / skipped / inputs / checked / 降格理由）
// だけを話す。JSON・正準直列化・スキーマ適合検証は**形式の知識**であり
// アダプタ層の責務（オーナー裁定 2026-08-30：Json はユビキタス言語ではない）。
//
// 入口は 3 つ：
//   - compose      … 検査結果から新規に組む（正準ソートまでが構築の仕事）
//   - degraded     … 契約不適合と判定された文書の降格形（理由文言は emitter＝
//                    アダプタが組んで渡す。inputs は保持、内容は空になる——凍結挙動）
//   - reconstitute … 書かれた真実（アダプタが型付きに解いた状態）からの再構成

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import { sortFindings, sortSkipped } from "./catalog-order.ts";
import type { Finding } from "./finding.ts";
import type { InputEntry } from "./input-entry.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";
import type { Skipped } from "./skipped.ts";

export interface ReferenceCheckReportSeed {
  readonly id: ReferenceCheckReportId;
  readonly inputs: readonly InputEntry[];
  readonly checked: readonly string[];
  readonly findings: readonly Finding[];
  readonly skipped: readonly Skipped[];
}

export class ReferenceCheckReport {
  readonly #id: ReferenceCheckReportId;
  readonly #inputs: readonly InputEntry[];
  readonly #checked: readonly string[];
  readonly #findings: readonly Finding[];
  readonly #skipped: readonly Skipped[];
  readonly #unavailableReason: string | null;

  private constructor(
    id: ReferenceCheckReportId,
    inputs: readonly InputEntry[],
    checked: readonly string[],
    findings: readonly Finding[],
    skipped: readonly Skipped[],
    unavailableReason: string | null,
  ) {
    this.#id = id;
    this.#inputs = inputs;
    this.#checked = checked;
    this.#findings = findings;
    this.#skipped = skipped;
    this.#unavailableReason = unavailableReason;
  }

  // 検査結果からの新規構築。正準ソート（inputs は artifact 順・checked は
  // 一意化＋id 順・findings/skipped はカタログ順）は文書のドメイン的性質
  // なのでここで確定する。
  static compose(seed: ReferenceCheckReportSeed): ReferenceCheckReport {
    return new ReferenceCheckReport(
      seed.id,
      [...seed.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0)),
      sortedUnique([...seed.checked], idCompare),
      sortFindings([...seed.findings]),
      sortSkipped([...seed.skipped]),
      null,
    );
  }

  // 契約不適合時の降格形。inputs は保持し内容を空にする（凍結挙動）。
  // 理由文言は emitter（アダプタ）が組んで渡す——ドメインは値として保持する。
  degraded(reason: string): ReferenceCheckReport {
    return new ReferenceCheckReport(this.#id, this.#inputs, [], [], [], reason);
  }

  // 書かれた真実からの再構成（Repository の読出側だけが使う）。書込時に
  // 契約適合が保証されているため、並びも含め「書かれたまま」を保持する。
  static reconstitute(seed: ReferenceCheckReportSeed & { readonly unavailableReason: string | null }): ReferenceCheckReport {
    return new ReferenceCheckReport(
      seed.id,
      [...seed.inputs],
      [...seed.checked],
      [...seed.findings],
      [...seed.skipped],
      seed.unavailableReason,
    );
  }

  id(): ReferenceCheckReportId {
    return this.#id;
  }

  inputs(): readonly InputEntry[] {
    return this.#inputs;
  }

  checked(): readonly string[] {
    return this.#checked;
  }

  findings(): readonly Finding[] {
    return this.#findings;
  }

  skipped(): readonly Skipped[] {
    return this.#skipped;
  }

  unavailableReason(): string | null {
    return this.#unavailableReason;
  }

  isUnavailable(): boolean {
    return this.#unavailableReason !== null;
  }

  findingsCount(): number {
    return this.#findings.length;
  }

  skippedCount(): number {
    return this.#skipped.length;
  }

  // センサー verdict の述語：降格しておらず finding が 0 なら pass。
  passes(): boolean {
    return this.#unavailableReason === null && this.#findings.length === 0;
  }
}
