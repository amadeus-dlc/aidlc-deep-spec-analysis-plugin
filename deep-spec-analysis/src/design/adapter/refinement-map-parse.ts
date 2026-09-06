import type { RefinementMap } from "@deep-spec-analysis/design-domain";

// 契約4文書を解析するparseRefinementMapDocumentの結果型。
// 解析処理とエラー文言はrefinement-materials-repository-implementation.tsが所有する。
export type RefinementMapParse =
  | { readonly kind: "parsed"; readonly map: RefinementMap }
  | { readonly kind: "malformed"; readonly error: string };
