// 到達性プローブ（quint 設計バックエンドの FR8.4）：単一状態の到達可否。
// failed はプローブ実行自体の不成立（leftover 記録の材料）。
export type ReachabilityProbe = { kind: "failed" } | { kind: "probed"; reached: boolean };
