// kernel/infrastructure の公開 facade — 明示列挙のみ（export * 禁止）。
// この層は「言語を拡張する技術基盤」専用（オーナー裁定 2026-08-30）：
// 手巻き Result のような、ユビキタス言語ではない純粋な型・計算基盤を置く。
// RPC クライアント・永続化はここに置かない——それらはインターフェイス
// アダプタ層のゲートウェイ責務である。node への依存も持たない。

export { type Result, type Ok, type Err, ok, err, unreachable } from "./result.ts";
