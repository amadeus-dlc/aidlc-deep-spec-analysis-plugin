// 到達性プローブの変種 lowering（quint 設計バックエンドの FR8.4）。
// 状態 1 つの到達性のために：機械のイベント・定義的背景・単一不変量
// `attr != state` だけを載せた契約1 文書を組む。設計不変量は意図的に落とす——
// v1 の init は全不変量を満たすため、プローブ不変量が初期状態から当該状態を
// 除外し（到達には 1 ステップ要る）、設計不変量が invAll に残ると到達可能な
// 違反で先に転んでプローブを隠す。設計不変量なしの探索は到達性の過大近似で、
// それが健全な方向：「無制約でも到達しない」は本当に到達不能。
// probeReached：プローブ実行の違反トレースが実際にその状態で終わるときのみ
// 「到達した」と判定する（conflict 単体は証拠でない——ベルトとサスペンダー）。
// 旧 aidlc-sensor-deep-spec-design-verify-quint.ts からの逐語移植。

import { type Json, isObject } from "../../kernel/adapter/index.ts";

export function reachabilityVariant(base: Json, attrPath: string, state: string): Json {
  if (!isObject(base)) return base;
  const obligations = Array.isArray(base.obligations) ? base.obligations : [];
  const events = obligations.filter((ob) => isObject(ob) && ob.nature === "event");
  const probe = {
    id: "OB-9999",
    nature: "invariant",
    frRefs: [] as Json,
    assert: { op: "ne", args: [{ op: "ref", path: attrPath }, { op: "enum", value: state }] } as unknown as Json,
  };
  return {
    irVersion: base.irVersion ?? "1.0.0",
    schema: base.schema ?? { entities: [] },
    obligations: [...events, probe] as unknown as Json,
    scenarios: [] as unknown as Json,
    background: (Array.isArray(base.background) ? base.background : []) as unknown as Json,
  };
}

export function probeReached(doc: Json, attrPath: string, state: string): boolean {
  if (!isObject(doc) || !Array.isArray(doc.findings)) return false;
  for (const f of doc.findings) {
    if (!isObject(f) || f.kind !== "conflict") continue;
    const witness = isObject(f.witness) ? f.witness : {};
    const trace = Array.isArray(witness.trace) ? witness.trace : null;
    if (trace === null) return true; // トレース詳細なしの違反——到達したとみなす
    const last = trace[trace.length - 1];
    if (isObject(last) && last[attrPath] === state) return true;
  }
  return false;
}
