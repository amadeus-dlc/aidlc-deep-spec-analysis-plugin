// 到達性プローブの変種 lowering（quint 設計バックエンドの FR8.4）。
// 状態 1 つの到達性のために：機械のイベント・定義的背景・単一不変量
// `attr != state` だけを載せた契約1 文書を組む。設計不変量は意図的に落とす——
// v1 の init は全不変量を満たすため、プローブ不変量が初期状態から当該状態を
// 除外し（到達には 1 ステップ要る）、設計不変量が invAll に残ると到達可能な
// 違反で先に転んでプローブを隠す。設計不変量なしの探索は到達性の過大近似で、
// それが健全な方向：「無制約でも到達しない」は本当に到達不能。
// 実行結果の到達性判断は SiblingVerdictDocument が所有する。
// 旧 aidlc-sensor-deep-spec-design-verify-quint.ts からの逐語移植。

import { type Json, isObject } from "@deep-spec/kernel-infrastructure";

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
