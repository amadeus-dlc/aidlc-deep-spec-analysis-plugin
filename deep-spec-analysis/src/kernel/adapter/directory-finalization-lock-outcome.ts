// Directory lock の操作結果 — 取得・stale 回復・競合・回復失敗・解放・解放
// 失敗・cleanup 失敗を区別可能な内部結果として運ぶ（BR2.7）。外部向けの文言は
// 呼び手（Repository）が RepositoryError へ写像するときに決める：ここは材料
// だけを持ち、verdict も表示文言も持たない。

export type DirectoryFinalizationLockOutcome =
  // canonical path を単発の exclusive create で取れた。
  | { readonly kind: "acquired" }
  // 期限切れかつ所有者不在を確定してから奪い返した（旧 token を材料に残す）。
  | { readonly kind: "recovered"; readonly displacedToken: string }
  // 生存中・判定不能・token 変化——待機も再試行もせず終わる。
  | { readonly kind: "lock-contended"; readonly cause: string }
  // stale rename には勝ったが canonical の再取得に負けた（新 owner を壊さない）。
  | { readonly kind: "lock-recovery-failed"; readonly cause: string }
  | { readonly kind: "released" }
  // canonical の所有が自分でない／cleanup path への rename に負けた。
  | { readonly kind: "lock-release-failed"; readonly cause: string }
  // canonical は解放できたが owner 固有 cleanup path を消せなかった。
  | { readonly kind: "cleanup-failed"; readonly cause: string };
