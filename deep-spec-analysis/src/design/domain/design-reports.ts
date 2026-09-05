import { UnitName, BackendName, ContentHash, FindingKind, FrRefs, TargetId, TargetIds } from "@deep-spec/kernel-domain";

import { DesignCrossCheckedEntries } from "./design-cross-checked-entries.ts";
import { DesignCrossCheckedEntry } from "./design-cross-checked-entry.ts";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkips } from "./design-skips.ts";
import { DesignFinding } from "./design-finding.ts";
import { DesignWitness } from "./design-witness.ts";
import type { DesignModel } from "./design-model.ts";
import type { DesignReportId } from "./design-report-id.ts";
import { DesignReport } from "./design-report.ts";

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
        backend: s.id().backendName().asString(),
        findings: s.findings().toArray(),
        skipped: new Set(s.skipped().toArray().map((e) => `${e.unit()}|${e.target().asString()}`)),
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
            const key = `${u.name()}|${sc.id().asString()}`;
            if (a.skipped.has(key) || b.skipped.has(key)) continue;
            const verdictOf = (d: (typeof docs)[number]): boolean =>
              d.findings.some((f) => f.kind() === "scenario-violation" && f.unit() === u.name() && f.targets().includes(TargetId.of(sc.id().asString())));
            const va = verdictOf(a);
            const vb = verdictOf(b);
            (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(sc.id().asString());
            (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(sc.id().asString());
            if (va !== vb) {
              const verdicts: { [backend: string]: "violated" | "clean" } = {};
              verdicts[a.backend] = va ? "violated" : "clean";
              verdicts[b.backend] = vb ? "violated" : "clean";
              findings.push(
                DesignFinding.of({
                  kind: FindingKind.crossCheckDisagreement(),
                  frRefs: FrRefs.of([...sc.frRefs()]).sortedUnique(),
                  targets: TargetIds.of(Array.from([sc.id().asString()], (raw) => TargetId.of(raw))),
                  witness: DesignWitness.verdicts(verdicts),
                  unit: UnitName.of(u.name()),
                  detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()} of unit ${u.name()}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`,
                }),
              );
            }
          }
        }
      }
    }
    const crossChecked: DesignCrossCheckedEntry[] = [...comparedByBackend.entries()]
      .map(([backend, targets]) => DesignCrossCheckedEntry.of({ backend: BackendName.of(backend), targets: TargetIds.of(Array.from([...targets], (raw) => TargetId.of(raw))).sortedCanonically() }))
      .sort((x, y) => x.compareByBackend(y));

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
