import type { ContentHash } from "../../kernel/domain/index.ts";

// sourceDigest 照合の材料対——モデルが宣言した anchor と、現在の
// requirements.md バイトの実測 sha256。anchor は現行契約の必須宣言
//（ir-valid の SourceAnchor が強制）で、持たないモデルは無条件に stale
//（後方互換の mtime フォールバックはオーナー裁定 2026-09-01 で削除）。
export interface DigestAnchor {
  expected: ContentHash;
  actual: ContentHash;
}
