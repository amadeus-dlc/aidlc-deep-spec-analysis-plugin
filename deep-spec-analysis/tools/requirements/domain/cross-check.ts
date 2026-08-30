// クロスチェック — 同一 irHash の全バックエンド文書から、両者が判定した
// シナリオの合意/不一致を計算して cross-check レポートを組む純関数。
// 不一致は「形式化かバックエンドコンパイラの欠陥」であり要件の欠陥ではない
// （detail 文言は golden 凍結）。全書き手がこれを再計算して収束するため、
// 結果はセンサーの発火順に依存しない。旧 recomputeCrossCheck の計算部の
// 逐語移植（成立文書の選別のうち、読めないファイルの黙殺は Repository 側）。

import { VerificationFindings, VerificationSkips } from "./verification-finding.ts";
import { CrossCheckedEntries, VerificationReports } from "./verification-report.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import type { VerificationFinding } from "./verification-finding.ts";
import { type CrossCheckedEntry, VerificationReport } from "./verification-report.ts";
import type { VerificationReportId } from "./verification-report-id.ts";

export function crossCheckReport(
  id: VerificationReportId,
  model: RequirementsModel,
  irHash: ContentHash,
  siblings: VerificationReports,
): VerificationReport {
  // 比較に参加するのは同一 irHash の可用文書のみ（旧実装の読込時選別と同値）。
  const docs = siblings
    .toArray()
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
            frRefs: sortedUnique(scenarioById.get(sc.id)?.frRefs ?? [], idCompare),
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
