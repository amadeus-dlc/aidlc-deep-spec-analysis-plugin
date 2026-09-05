// DesignVerifyDirectory 集約の Repository ポート。
//
// リポジトリの責務は集約を I/O することだけで、語彙は保存・検索・取得・削除に
// 閉じる（オーナー裁定 2026-09-04）。この契約はその語彙にしか依存しない：
// 適合（conformedTo）・クロスチェックの導出・候補の差し替えはすべて集約の
// 振る舞いで、Repository のメソッド変種では表さない。可変部（導けないクロス
// チェック）も集約が不在で持ち、ここには現れない。
//
// findByDirectory はクロスチェックの取得規則を持つ：cross-check.json を除く
// *.json をファイル名順で読み、公開済みの cross-check.json があればそれも
// 読む。読めないファイルは黙って除かず、型のある失敗として運ぶ（BR2.7）。
// store は Workflow 1 の finalization：同じディレクトリの writer を直列化し、
// 集約が決めた文書だけを原子的に公開する。CQS（オーナー裁定 2026-09-01）：
// コマンドは書くだけ——正常時は void。

import type { DesignVerifyDirectory } from "@deep-spec/design-domain";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { Result } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";

export interface DesignVerifyDirectoryRepository {
  findByDirectory(directory: ArtifactPath): Result<DesignVerifyDirectory, RepositoryError>;
  store(aggregate: DesignVerifyDirectory): Result<void, RepositoryError>;
}
