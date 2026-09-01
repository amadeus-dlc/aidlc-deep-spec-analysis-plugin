import { ContentHash } from "../../kernel/domain/index.ts";

// 入力成果物の錨（refcheck の InputAnchor と同語彙・コンテキスト所有）。
export interface DesignInputAnchor {
  readonly artifact: string;
  readonly sha256: ContentHash;
}
