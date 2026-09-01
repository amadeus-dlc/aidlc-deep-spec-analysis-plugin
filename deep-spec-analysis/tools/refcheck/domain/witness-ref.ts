// witness refs の 1 座標（成果物パス＋要素＋生値）。deep-spec-lib.ts からの逐語移動。
// 集まりはファーストクラスコレクション（記録順＝ペイロード順を保持）。

export interface WitnessRef {
  artifact: string;
  element: string;
  value?: string;
}

