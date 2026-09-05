// kernel/infrastructure の公開 facade — 明示列挙のみ（export * 禁止）。
// この層は「言語を拡張する技術基盤」専用（オーナー裁定 2026-08-30）：
// 手巻き Result のような、ユビキタス言語ではない純粋な型・計算基盤を置く。
// RPC クライアント・永続化はここに置かない——それらはインターフェイス
// アダプタ層のゲートウェイ責務である。node への依存も持たない。

export { type Result, ok, err, unreachable } from "./result.ts";
export { type Err } from "./err.ts";
export { type Ok } from "./ok.ts";
export { type Json, isObject, strArr } from "./json.ts";
export { type Schema, validateSchema } from "./schema.ts";
export { canonicalStringify } from "./canonical-json.ts";
export { IllegalArgumentException } from "./illegal-argument-exception.ts";
export { parseConstruction } from "./parse-construction.ts";
export { compareCanonically, sortedUniqueCanonically } from "./canonical-order.ts";
export { combineResults, traverseResult } from "./result-composition.ts";
