// v1 兄弟バックエンドの生 findings 文書 → 型付き判定面（SiblingVerdictDocument）。
// 選別規則は旧 remapUnitDocument の読込部の凍結挙動：非オブジェクト → unreadable、
// unavailable.reason → unavailable、findings は {kind:string, targets:array}
// のエントリのみ、frRefs は文字列選別、detail は文字列でなければ ""、witness
// は素通し。skipped は {target:string, reason:string} のみ。

import { type Json, isObject } from "../../kernel/adapter/index.ts";
import type { DesignValue, SiblingVerdictDocument, SiblingVerdictFinding, SiblingVerdictSkip } from "../domain/index.ts";

const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);

export function parseSiblingVerdictDocument(raw: Json): SiblingVerdictDocument {
  if (!isObject(raw)) return { kind: "unreadable" };
  if (isObject(raw.unavailable) && typeof raw.unavailable.reason === "string") {
    return { kind: "unavailable", reason: raw.unavailable.reason, method: typeof raw.method === "string" ? raw.method : null };
  }
  const findings: SiblingVerdictFinding[] = [];
  for (const f of Array.isArray(raw.findings) ? raw.findings : []) {
    if (!isObject(f) || typeof f.kind !== "string" || !Array.isArray(f.targets)) continue;
    findings.push({
      kind: f.kind,
      frRefs: strArr(f.frRefs),
      targets: f.targets.filter((t): t is string => typeof t === "string"),
      witness: (f.witness ?? null) as unknown as DesignValue,
      detail: typeof f.detail === "string" ? f.detail : "",
    });
  }
  const skipped: SiblingVerdictSkip[] = [];
  for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
    if (!isObject(s) || typeof s.target !== "string" || typeof s.reason !== "string") continue;
    const out: SiblingVerdictSkip = { target: s.target, reason: s.reason };
    if (typeof s.detail === "string") out.detail = s.detail;
    skipped.push(out);
  }
  return { kind: "readable", method: typeof raw.method === "string" ? raw.method : null, findings, skipped };
}
