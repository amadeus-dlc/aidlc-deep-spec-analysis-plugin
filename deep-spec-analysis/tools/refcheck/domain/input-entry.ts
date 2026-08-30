// 入力成果物のマニフェスト行（irHash の材料）。deep-spec-lib.ts からの逐語移動。
// sha256 は ContentHash DP（計算経路は常に正、文書再水和は reconstitute）。

import type { ContentHash } from "../../kernel/domain/index.ts";

export interface InputEntry {
  artifact: string;
  sha256: ContentHash;
}
