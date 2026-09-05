export interface SolverProbeClientConfiguration {
  readonly projectDir: string;
  readonly quintBin: string;
  readonly apalacheDistDeclared: boolean;
  readonly homeDir: string;
  // quint が既定で使う Apalache サーバのポート。ここで待ち受けがあるときだけ
  // 実 verify のプローブを払う。
  readonly apalachePort: number;
  // いま走っているランタイムの実行ファイル（entry が process.execPath を注入
  // する）。availability() を同期に保ったまま TCP 待ち受けを調べるための子。
  readonly runtimeBin: string;
}
