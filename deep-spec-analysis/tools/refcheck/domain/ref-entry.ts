// witness refs の 1 座標（成果物パス＋要素＋生値）。deep-spec-lib.ts からの逐語移動。
// PR2b で Finding の VO 化と併せて再モデル化予定。

export interface RefEntry {
  artifact: string;
  element: string;
  value?: string;
}
