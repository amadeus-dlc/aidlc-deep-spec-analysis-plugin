# 規則別の確認範囲

対象コミット: `26324f9`。全原本の構造走査と重点精読を組み合わせた結果。機械検査が通った規則と、振る舞いで問題を再現した規則を区別する。「重点箇所で新規指摘なし」は、全実行経路の形式的な証明を意味しない。

| 規則 | 状況 | 確認した範囲・判断 |
| --- | --- | --- |
| [abstract-data-type.md](../../../../knowledge/aidlc-shared/coding-rules/abstract-data-type.md) | 不適合: R1 / R2 / R3 / R4 | 結果の不在・IDの値域・所有権・入力型の制約を公開APIで再現。 |
| [field-visibility.md](../../../../knowledge/aidlc-shared/coding-rules/field-visibility.md) | 構造検査通過、所有権はR3 | privateフィールド自体は検査を通るが、入力参照を通じた変更が残る。 |
| [module-visibility.md](../../../../knowledge/aidlc-shared/coding-rules/module-visibility.md) | 機械検査通過 | ファサード、相対import、package manifest、未分類ファイルを検査。 |
| [domain-equality.md](../../../../knowledge/aidlc-shared/coding-rules/domain-equality.md) | 重点箇所で新規指摘なし | 値のequalsと正準順の違いを確認。ID変換に依存した比較のpanicはR2。 |
| [factory-naming.md](../../../../knowledge/aidlc-shared/coding-rules/factory-naming.md) | 不適合: R2 / R3 / R4 | private constructorやparseの存在だけでは、有効値域・入力型・スナップショットを保証しない。 |
| [error-handling.md](../../../../knowledge/aidlc-shared/coding-rules/error-handling.md) | 不適合: R1 / R2 | 入力失敗のResult経路と、予期されないpanicの区別を確認。 |
| [command-query-separation.md](../../../../knowledge/aidlc-shared/coding-rules/command-query-separation.md) | 重点箇所で新規指摘なし | voidの集約操作、不変変換、既存のFinalizer例外を区別。CQRSは要求していない。 |
| [interior-mutability.md](../../../../knowledge/aidlc-shared/coding-rules/interior-mutability.md) | 不適合: R3 | 入力record、raw配列、tupleの別名参照を確認。 |
| [gateway-taxonomy.md](../../../../knowledge/aidlc-shared/coding-rules/gateway-taxonomy.md) | 応答契約にR1 | Repositoryと外部クライアントの配置は検査通過。子プロセス契約の完全性が不足。 |
| [use-case-rules.md](../../../../knowledge/aidlc-shared/coding-rules/use-case-rules.md) | 重点箇所で新規指摘なし | usecaseからadapter実装への依存、別UseCaseの直接利用を走査。Finalizerは既存のapplication collaboratorとして扱う。 |
| [infrastructure-layer.md](../../../../knowledge/aidlc-shared/coding-rules/infrastructure-layer.md) | 機械検査通過 | 純粋な最内層の依存・I/O規則を確認。 |
| [domain-persistence-neutrality.md](../../../../knowledge/aidlc-shared/coding-rules/domain-persistence-neutrality.md) | 重点箇所で新規指摘なし | I/Oはadapter、文書契約と不変スナップショットは既存裁定を維持。原文所有権の問題はR3。 |
| [aggregate-commands.md](../../../../knowledge/aidlc-shared/coding-rules/aggregate-commands.md) | 所有権にR3 | 既存のcross-check無効化・不変変換と、外側からの無断変更を区別。 |
| [aggregate-references.md](../../../../knowledge/aidlc-shared/coding-rules/aggregate-references.md) | 重点箇所で新規指摘なし | Directoryが保持する検証結果は既存の観測記録の集約として扱い、包含だけで違反としない。 |
| [domain-object-kinds.md](../../../../knowledge/aidlc-shared/coding-rules/domain-object-kinds.md) | 重点箇所で新規指摘なし | 既存裁定済みの型分類を前提とし、名前だけでMaterialsやPlanをサービス扱いしない。 |
| [domain-services.md](../../../../knowledge/aidlc-shared/coding-rules/domain-services.md) | 重点箇所で新規指摘なし | 公開操作の所有者を確認。所有する型のファイル内の実装補助を、独立した新設サービスと混同しない。 |
| [tell-dont-ask.md](../../../../knowledge/aidlc-shared/coding-rules/tell-dont-ask.md) | 未検証の解釈にR1 | SMT結果の不在を計画の各所が読み捨てる。状態の明示化で分岐を減らせる。 |
| [ubiquitous-language.md](../../../../knowledge/aidlc-shared/coding-rules/ubiquitous-language.md) | 重点箇所で新規指摘なし | 既存のドメイン語・外部に出る値・内部実装語を区別。命名変更だけの指摘は採らない。 |
| [upstream-contracts.md](../../../../knowledge/aidlc-shared/coding-rules/upstream-contracts.md) | 不適合: R1、要整理: O1 | 発行したクエリに対する結果の欠落。モデルの寛容読みは互換性との関係を別途整理。 |
| [no-backward-compatibility.md](../../../../knowledge/aidlc-shared/coding-rules/no-backward-compatibility.md) | 機械走査で新規指摘なし | reconstituteの再導入・生成入口の互換並立を走査。公開文書の互換性は別扱い。 |
| [good-examples.md](../../../../knowledge/aidlc-shared/coding-rules/good-examples.md) | 参照先は存在、一般化に注意 | IR versionやpanic境界の例が通っていても、すべてのDP・宣言・応答処理の証明にはならない。 |

指摘の根拠・影響・修正方針は[監査結果](review.md)、件数と除外範囲は[scope.json](scope.json)を参照。
