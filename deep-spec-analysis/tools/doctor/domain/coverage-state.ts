// カバレッジ行の状態——検証が無い（unverified）か、検証後に素材が変わった
//（stale）か。
export type CoverageState = "unverified" | "stale";
