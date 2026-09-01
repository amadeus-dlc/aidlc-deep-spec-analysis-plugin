// InputAnchor — 入力成果物の錨。検査が「どの入力成果物のどのバイト列に
// 基づいたか」の宣言で、文書の inputs[] に逐語で載り（irHash の材料）、
// 下流の陳腐化検出の根拠になる。requirements の SourceAnchor と同じ
// 「内容による錨着」の語彙（旧名 InputEntry — 台帳行という技術語だった）。

import type { ContentHash } from "../../kernel/domain/index.ts";

export interface InputAnchor {
  artifact: string;
  sha256: ContentHash;
}

