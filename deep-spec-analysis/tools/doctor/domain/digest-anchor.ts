import type { ContentHash } from "../../kernel/domain/index.ts";

// sourceDigest 照合の材料対——モデルが宣言した anchor と、現在の
// requirements.md バイトの実測 sha256。anchor を持たない旧モデルでは対ごと
// 欠け、mtime ヒューリスティックへフォールバックする。
export interface DigestAnchor {
  expected: ContentHash;
  actual: ContentHash;
}
