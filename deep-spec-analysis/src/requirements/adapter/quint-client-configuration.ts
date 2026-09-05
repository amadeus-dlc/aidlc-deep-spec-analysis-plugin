export interface QuintClientConfiguration {
  readonly quintBin: string;
  readonly methodOverride: string | undefined;
  readonly apalacheDistSet: boolean;
  readonly homeDirectory: string;
  // すべての CLI 実行の予算をこの値で上書きする（テスト専用の注入口——
  // 秒単位の凍結予算を待たずにタイムアウト経路を踏むため）。省略時は
  // フェーズごとの凍結定数。
  readonly timeoutOverrideMs?: number;
}
