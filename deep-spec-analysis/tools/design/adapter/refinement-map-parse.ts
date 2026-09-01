import { RefinementMap } from "../../refinement/domain/index.ts";

// 契約4 文書の共有パーサ——凍結エラー文言はここが唯一の発生点で、composite の
// absent(error) と RefinementMapRepository の corrupt.cause が常に一致する。
export type RefinementMapParse =
  | { readonly kind: "parsed"; readonly map: RefinementMap }
  | { readonly kind: "malformed"; readonly error: string };
