// lowered 設計ユニットを PROVEN v1 バックエンドの子プロセスで実行するポート。
// 契約1 文書への直列化・ITF/JSON の解体・到達性プローブの変種組換えは実装
// （アダプタ）が持ち、ポートは domain 語彙（型付き lowering と型付き判定面）
// だけを話す。doc: null は findings ファイルが読めなかったこと（"produced no
// findings document" 経路）、SiblingVerdictDocument の "unreadable" は読めたが
// 文書として成立しないことを区別する（旧挙動の凍結）。

import type { DesignUnit, LoweredUnit, SiblingVerdictDocument } from "../domain/index.ts";

export interface SiblingLoweredRun {
  exit: number | null;
  doc: SiblingVerdictDocument | null;
  note: string;
}

// 到達性プローブ（quint 設計バックエンドの FR8.4）：単一状態の到達可否。
// failed はプローブ実行自体の不成立（leftover 記録の材料）。
export type ReachabilityProbe = { kind: "failed" } | { kind: "probed"; reached: boolean };

export interface SiblingBackendClient {
  runLowered(backend: "smt" | "quint", unit: DesignUnit, lowered: LoweredUnit, wallTimeoutMs: number): SiblingLoweredRun;
  probeState(unit: DesignUnit, lowered: LoweredUnit, attrPath: string, state: string, wallTimeoutMs: number): ReachabilityProbe;
}
