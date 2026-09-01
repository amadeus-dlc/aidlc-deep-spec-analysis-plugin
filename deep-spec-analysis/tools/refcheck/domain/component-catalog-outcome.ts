import { ComponentShapeErrors } from "./component-shape-errors.ts";
import { Components } from "./components.ts";
// アダプタのパーサが返す解析結果（DD-0 の判定材料まで型で運ぶ）。
// エラー分岐（wrong-fence-count / unparseable）は材料のみの閉じたユニオン。
export type ComponentCatalogOutcome =
  | { readonly kind: "wrong-fence-count"; readonly found: number }
  | { readonly kind: "unparseable"; readonly line: number; readonly error: string }
  | { readonly kind: "extracted"; readonly components: Components; readonly shapeErrors: ComponentShapeErrors };
