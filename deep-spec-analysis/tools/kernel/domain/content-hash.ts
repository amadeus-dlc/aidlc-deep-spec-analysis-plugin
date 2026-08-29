// コンテンツハッシュ — sha256 hex。純計算のため domain 層で node:crypto を
// 唯一許可されるモジュール（アーキテクチャルール参照）。逐語移動。

import { createHash } from "node:crypto";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}
