// kernel/usecase の公開 facade — 明示列挙のみ（export * 禁止）。
// Repository 関連（ポート語彙）は use-case 層に置く：ドメイン層に置くと
// ドメインオブジェクト内部から Repository を使うリスクが生まれるため、
// アウトプットポートの一部としてここで定義する（オーナー裁定 2026-08-30）。

export { type RepositoryError } from "./repository-error.ts";
