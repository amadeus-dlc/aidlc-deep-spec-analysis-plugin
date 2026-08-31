// DesignReport 集約 — 設計バックエンド（smt / quint / cross-check）の検証結果
// 文書（契約2 拡張：unit 帰属つき finding・inputs/checked 任意）のドメイン表現。
// compose が正準ソート（findings/skipped の設計順・inputs の artifact 順・
// checked の sortedUnique）を不変条件として一度だけ適用する。直列化（キー順・
// 描画）はアダプタの serializer が持つ。degraded は契約適合の降格形
// （findings/skipped/inputs/checked/crossChecked を空にして unavailable 理由
// だけ残す——旧 writeDesignDoc の自己検証降格と同じ姿）。

import { BackendName, ContentHash, FrRefs, IrVersion, TargetIds, IdOrder } from "../../kernel/domain/index.ts";
import type { DesignModel } from "./design-model.ts";
import { DesignFindings, DesignSkips } from "./design-finding.ts";
import type { DesignFinding } from "./design-finding.ts";
import type { DesignReportId } from "./design-report-id.ts";

// 入力成果物の錨（refcheck の InputAnchor と同語彙・コンテキスト所有）。
export interface DesignInputAnchor {
  readonly artifact: string;
  readonly sha256: ContentHash;
}

export interface DesignCrossCheckedEntry {
  readonly backend: BackendName;
  readonly targets: TargetIds;
}

// 入力成果物の錨のファーストクラスコレクション。artifact 名昇順の整列
// （compose の不変条件）を所有する。
export class DesignInputAnchors {
  readonly #values: readonly DesignInputAnchor[];

  private constructor(values: readonly DesignInputAnchor[]) {
    this.#values = values;
  }

  static of(values: readonly DesignInputAnchor[]): DesignInputAnchors {
    return new DesignInputAnchors([...values]);
  }

  add(value: DesignInputAnchor): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignInputAnchor> {
    yield* this.#values;
  }

  sortedByArtifact(): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0)));
  }

  toArray(): readonly DesignInputAnchor[] {
    return this.#values;
  }
}

// 検査済みユニット面のファーストクラスコレクション。id 順の一意整列
// （compose の不変条件）を所有する。
export class CheckedUnits {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): CheckedUnits {
    return new CheckedUnits([...values]);
  }

  add(value: string): CheckedUnits {
    return new CheckedUnits([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  sortedUniqueCanonically(): CheckedUnits {
    return new CheckedUnits(IdOrder.sortedUnique([...this.#values], IdOrder.compare));
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}

// クロスチェック判定表のファーストクラスコレクション。
export class DesignCrossCheckedEntries {
  readonly #values: readonly DesignCrossCheckedEntry[];

  private constructor(values: readonly DesignCrossCheckedEntry[]) {
    this.#values = values;
  }

  static of(values: readonly DesignCrossCheckedEntry[]): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries([...values]);
  }

  add(value: DesignCrossCheckedEntry): DesignCrossCheckedEntries {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignCrossCheckedEntry> {
    yield* this.#values;
  }

  toArray(): readonly DesignCrossCheckedEntry[] {
    return this.#values;
  }
}

export interface DesignReportSeed {
  readonly id: DesignReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  readonly inputs: DesignInputAnchors | null;
  readonly checked: CheckedUnits | null;
  readonly crossChecked: DesignCrossCheckedEntries | null;
  readonly unavailableReason: string | null;
}

export interface DesignReportComposition {
  readonly id: DesignReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: DesignFindings;
  readonly skipped: DesignSkips;
  readonly inputs?: DesignInputAnchors;
  readonly checked?: CheckedUnits;
  readonly crossChecked?: DesignCrossCheckedEntries;
  readonly unavailableReason?: string;
}

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
        u.allTargets().map((t) => ({
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
        u.allTargets().map((t) => ({ target: t, reason: "unavailable", unit: u.name(), detail: skipDetail })),
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

// 兄弟文書のファーストクラスコレクション（設計クロスチェックの入力）。
export class DesignReports {
  readonly #values: readonly DesignReport[];

  private constructor(values: readonly DesignReport[]) {
    this.#values = values;
  }

  static of(values: readonly DesignReport[]): DesignReports {
    return new DesignReports([...values]);
  }

  add(value: DesignReport): DesignReports {
    return new DesignReports([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignReport> {
    yield* this.#values;
  }

  toArray(): readonly DesignReport[] {
    return this.#values;
  }
  // 設計クロスチェック — 同一 irHash の全バックエンド文書から (unit, scenario)
  // ごとの判定合意を計算して cross-check レポートを組む（v1 と同じ収束設計：
  // 最後の書き手が勝ち、全書き手が同一バイトへ収束。detail 文言は golden 凍結
  // "...not in the design itself."）。旧 designCrossCheckReport の逐語移植
  // （読めないファイルの黙殺は Repository 側）。
  crossChecked(id: DesignReportId, model: DesignModel, irHash: ContentHash): DesignReport {
    // 比較に参加するのは同一 irHash の可用文書のみ（旧実装の読込時選別と同値）。
    const docs = this.toArray()
      .filter((s) => s.irHash().equals(irHash) && !s.isUnavailable())
      .map((s) => ({
        backend: s.id().backendName(),
        findings: s.findings().toArray(),
        skipped: new Set(
          s
            .skipped()
            .toArray()
            .filter((e) => typeof e.target === "string")
            .map((e) => `${typeof e.unit === "string" ? e.unit : ""}|${e.target}`),
        ),
      }));

    const findings: DesignFinding[] = [];
    const comparedByBackend = new Map<string, Set<string>>();
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (!a || !b) continue;
        for (const u of model.units()) {
          for (const sc of u.scenarios()) {
            const key = `${u.name()}|${sc.id}`;
            if (a.skipped.has(key) || b.skipped.has(key)) continue;
            const verdictOf = (d: (typeof docs)[number]): boolean =>
              d.findings.some((f) => f.kind === "scenario-violation" && f.unit === u.name() && f.targets.includes(sc.id));
            const va = verdictOf(a);
            const vb = verdictOf(b);
            (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(sc.id);
            (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(sc.id);
            if (va !== vb) {
              const verdicts: { [backend: string]: "violated" | "clean" } = {};
              verdicts[a.backend] = va ? "violated" : "clean";
              verdicts[b.backend] = vb ? "violated" : "clean";
              findings.push({
                kind: "cross-check-disagreement",
                frRefs: FrRefs.of(IdOrder.sortedUnique([...sc.frRefs], IdOrder.compare)),
                targets: TargetIds.of([sc.id]),
                witness: { verdicts },
                unit: u.name(),
                detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id} of unit ${u.name()}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`,
              });
            }
          }
        }
      }
    }
    const crossChecked: DesignCrossCheckedEntry[] = [...comparedByBackend.entries()]
      .map(([backend, targets]) => ({ backend: BackendName.reconstitute(backend), targets: TargetIds.of([...targets].sort(IdOrder.compare)) }))
      .sort((x, y) => (x.backend.asString() < y.backend.asString() ? -1 : x.backend.asString() > y.backend.asString() ? 1 : 0));

    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of([]),
      crossChecked: DesignCrossCheckedEntries.of(crossChecked),
    });
  }

}
