# 内部APIに不要な互換口を残さない

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/no-backward-compatibility.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 規則

- 内部の改名や署名変更では、呼び出し側も同時に直す。旧名のエイリアスや同じ責務の別入口を放置しない。
- `reconstitute`と`of`のような検証契約の二重化で、古い利用方法を温存しない。
- 非推奨の入口を残す必要があるなら、その利用者・移行期限・互換性の契約を具体的に示す。
- 移行後は旧入口の利用箇所が残っていないことを検索で確認する。

## 公開契約は別に扱う

移植元の「未配布なので互換性の対価がない」という前提は、この配布済みプラグインには適用しない。外部に公開するCLI、文書スキーマ、出力の意味・文言・順序の変更は、既存の互換性・リリース規則に従う。

「内部の互換口を増やさない」を、公開契約を自由に壊してよい理由にしてはならない。

関連: [外部契約](upstream-contracts.md)、[生成規則](factory-naming.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
