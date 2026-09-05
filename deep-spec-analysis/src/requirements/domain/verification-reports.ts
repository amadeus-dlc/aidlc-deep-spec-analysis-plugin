import {
  BackendName,
  type ContentHash,
  FindingKind,
  FunctionalRequirementReferences,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec/kernel-domain";

import { CrossCheckedEntries } from "./cross-checked-entries.ts";
import { CrossCheckedEntry } from "./cross-checked-entry.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { VerificationFinding } from "./verification-finding.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationReport } from "./verification-report.ts";
import type { VerificationReportIdentifier } from "./verification-report-identifier.ts";
import { VerificationSkips } from "./verification-skips.ts";
import { VerificationWitness } from "./verification-witness.ts";

// 兄弟文書のファーストクラスコレクション（クロスチェックの入力）。
export class VerificationReports {
  readonly #values: readonly VerificationReport[];

  private constructor(values: readonly VerificationReport[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly VerificationReport[]): VerificationReports {
    return new VerificationReports(values);
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
  crossChecked(id: VerificationReportIdentifier, model: RequirementsModel, irHash: ContentHash): VerificationReport {
    // 比較に参加するのは同一 irHash の可用文書のみ（旧実装の読込時選別と同値）。
    const docs = this.toArray()
      .filter((s) => s.irHash().equals(irHash) && !s.isUnavailable())
      .map((s) => ({
        backend: s.id().backendName().asString(),
        findings: s.findings().toArray(),
        skippedTargets: new Set(
          s
            .skipped()
            .toArray()
            .map((e) => e.target().asString()),
        ),
      }));

    const scenarioById = new Map(
      model
        .scenarios()
        .toArray()
        .map((s) => [s.id().asString(), s]),
    );
    const findings: VerificationFinding[] = [];
    const comparedByBackend = new Map<string, Set<string>>();
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (!a || !b) continue;
        for (const sc of model.scenarios()) {
          if (a.skippedTargets.has(sc.id().asString()) || b.skippedTargets.has(sc.id().asString())) continue;
          const va = a.findings.some((f) => f.isKind("scenario-violation") && f.implicates(sc.id().asTargetId()));
          const vb = b.findings.some((f) => f.isKind("scenario-violation") && f.implicates(sc.id().asTargetId()));
          (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set()).get(a.backend))?.add(
            sc.id().asString(),
          );
          (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set()).get(b.backend))?.add(
            sc.id().asString(),
          );
          if (va !== vb) {
            const verdicts: { [backend: string]: "violated" | "clean" } = {};
            verdicts[a.backend] = va ? "violated" : "clean";
            verdicts[b.backend] = vb ? "violated" : "clean";
            findings.push(
              VerificationFinding.of({
                kind: FindingKind.crossCheckDisagreement(),
                functionalRequirementReferences: FunctionalRequirementReferences.of([
                  ...(scenarioById.get(sc.id().asString())?.functionalRequirementReferences().toArray() ?? []),
                ]).sortedUnique(),
                targets: TargetIdentifiers.of([sc.id().asTargetId()]),
                witness: VerificationWitness.verdicts(verdicts),
                detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`,
              }),
            );
          }
        }
      }
    }
    const crossChecked: CrossCheckedEntry[] = [...comparedByBackend.entries()]
      .map(([backend, targets]) =>
        CrossCheckedEntry.of({
          backend: BackendName.of(backend),
          targets: TargetIdentifiers.of(
            Array.from([...targets], (raw) => TargetIdentifier.of(raw)),
          ).sortedCanonically(),
        }),
      )
      .sort((x, y) => x.compareByBackend(y));

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
