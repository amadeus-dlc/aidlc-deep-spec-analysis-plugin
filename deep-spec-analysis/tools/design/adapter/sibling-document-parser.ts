import { FrRefs } from "../../kernel/domain/index.ts";
// v1 兄弟バックエンドの生 findings 文書 → 型付き判定面（SiblingVerdictDocument）。
// 選別規則は旧 remapUnitDocument の読込部の凍結挙動：非オブジェクト → unreadable、
// unavailable.reason → unavailable、findings は {kind:string, targets:array}
// のエントリのみ、frRefs は文字列選別、detail は文字列でなければ ""、witness
// は素通し。skipped は {target:string, reason:string} のみ。

import { type Json, isObject, strArr } from "../../kernel/adapter/index.ts";
import { LoweredId, SiblingVerdictFindings, SiblingVerdictSkips, SiblingVerdictSkip, SiblingVerdictDocument, SiblingVerdictFinding } from "../domain/index.ts";
import { DesignWitness } from "../domain/index.ts";


export function parseSiblingVerdictDocument(raw: Json): SiblingVerdictDocument {
  if (!isObject(raw)) return SiblingVerdictDocument.unreadable();
  if (isObject(raw.unavailable) && typeof raw.unavailable.reason === "string") {
    return SiblingVerdictDocument.unavailable(raw.unavailable.reason, typeof raw.method === "string" ? raw.method : null);
  }
  const findings: SiblingVerdictFinding[] = [];
  for (const f of Array.isArray(raw.findings) ? raw.findings : []) {
    if (!isObject(f) || typeof f.kind !== "string" || !Array.isArray(f.targets)) continue;
    findings.push(SiblingVerdictFinding.reconstitute({
      kind: f.kind,
      frRefs: FrRefs.of(strArr(f.frRefs)),
      targets: f.targets.filter((t): t is string => typeof t === "string").map((t) => LoweredId.reconstitute(t)),
      witness: DesignWitness.fromDocument(f.witness ?? null),
      detail: typeof f.detail === "string" ? f.detail : "",
    }));
  }
  const skipped: SiblingVerdictSkip[] = [];
  for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
    if (!isObject(s) || typeof s.target !== "string" || typeof s.reason !== "string") continue;
    skipped.push(SiblingVerdictSkip.reconstitute({
      target: LoweredId.reconstitute(s.target),
      reason: s.reason,
      ...(typeof s.detail === "string" ? { detail: s.detail } : {}),
    }));
  }
  return SiblingVerdictDocument.readable(typeof raw.method === "string" ? raw.method : null, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
}
