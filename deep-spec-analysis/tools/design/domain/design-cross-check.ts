// 設計クロスチェック — 同一 irHash の全バックエンド文書から (unit, scenario)
// ごとの判定合意を計算して cross-check レポートを組む純関数（v1 と同じ収束
// 設計：最後の書き手が勝ち、全書き手が同一バイトへ収束）。detail 文言は
// golden 凍結（"...not in the design itself."）。
// 旧 recomputeDesignCrossCheck の計算部の逐語移植（読めないファイルの黙殺は
// Repository 側）。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { DesignFinding } from "./design-finding.ts";
import type { DesignModel } from "./design-model.ts";
import { type DesignCrossCheckedEntry, DesignReport } from "./design-report.ts";
import type { DesignReportId } from "./design-report-id.ts";

export function designCrossCheckReport(
  id: DesignReportId,
  model: DesignModel,
  irHash: string,
  siblings: readonly DesignReport[],
): DesignReport {
  // 比較に参加するのは同一 irHash の可用文書のみ（旧実装の読込時選別と同値）。
  const docs = siblings
    .filter((s) => s.irHash() === irHash && !s.isUnavailable())
    .map((s) => ({
      backend: s.id().backendName(),
      findings: s.findings(),
      skipped: new Set(
        s
          .skipped()
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
            d.findings.some((f) => f.kind === "scenario-violation" && f.unit === u.name() && Array.isArray(f.targets) && f.targets.includes(sc.id));
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
              frRefs: sortedUnique(sc.frRefs, idCompare),
              targets: [sc.id],
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
    .map(([backend, targets]) => ({ backend, targets: [...targets].sort(idCompare) }))
    .sort((x, y) => (x.backend < y.backend ? -1 : x.backend > y.backend ? 1 : 0));

  return DesignReport.compose({
    id,
    irVersion: model.irVersion(),
    irHash,
    method: "exhaustive",
    findings,
    skipped: [],
    crossChecked,
  });
}
