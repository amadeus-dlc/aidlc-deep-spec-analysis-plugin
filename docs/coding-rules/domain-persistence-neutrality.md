# ドメインを永続化の機構から独立させる

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/domain-persistence-neutrality.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 原則

ドメイン型は、ファイルシステム・DB・保存ライブラリの都合を知らない。不変条件と業務上の操作を所有する。

- DBの列や保存ライブラリのinterfaceを、ドメインの構造や公開契約として持ち込まない。
- 外部文書の復号用DTOはadapterが所有する。復号の都合だけで、ドメイン型と同じ構造の中間モデルを作らない。
- 外部形式の生値は各DPの`parse`へ渡し、Resultを処理してから集約を組み立てる。復元のために不変条件を免除しない。
- ファイルの読み書き・JSON文字列への描画など、I/Oの機構はadapterへ閉じる。

## 概念と機構を区別する

findingsの意味、公開する文書のキー順、正準順、検証対象の原文とハッシュの対応は、このプラグインが扱う契約である。それらをドメインが所有する既存の`toDocument`や不変スナップショットは維持する。

「adapterが消費する」という理由だけで、ドメインの概念を追い出さない。一方、JSONの読み書きや保存媒体の都合を、ドメインの概念と呼び替えて持ち込まない。

関連: [外部契約](upstream-contracts.md)、[生成規則](factory-naming.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
