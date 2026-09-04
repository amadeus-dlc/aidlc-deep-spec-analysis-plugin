// OS プロセス生存の観測ポート — directory lock の回復判定はこの観測にだけ
// 依存する。process.* を触ってよいのは合成ルート（entry）だけなので、実 probe
// は entry が組み立てて注入し、層のファイルは注入された観測だけを使う。
// statusOf は 3 値：生存確定・不在確定・不明。不明を不在へ丸めない——丸めると
// 生きている所有者の lock を奪う（lease 期限は死亡証明ではない）。

export interface ProcessLiveness {
  // この writer 自身の PID。lock metadata へ記録する。
  self(): number;
  // 記録された PID の生存。権限などで判定できないときは "unknown"。
  statusOf(pid: number): "alive" | "absent" | "unknown";
}
