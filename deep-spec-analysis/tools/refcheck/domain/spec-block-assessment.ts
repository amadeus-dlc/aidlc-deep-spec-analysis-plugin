import { type BlockIndex } from "./block-index.ts";
import { type LineNumber } from "./line-number.ts";

// 各 yaml spec ブロックの検査済み状態（CD-2 の判定材料）。issue の分岐は
// 材料のみの閉じたユニオン。
export interface SpecBlockAssessment {
  readonly index: BlockIndex; // 1-based
  readonly line: LineNumber;
  readonly issue:
    | { readonly kind: "unparseable"; readonly error: string }
    | { readonly kind: "not-a-mapping" }
    | { readonly kind: "openapi-without-paths" }
    | null;
}
