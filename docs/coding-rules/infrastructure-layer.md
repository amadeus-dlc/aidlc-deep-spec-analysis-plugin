# infrastructureは純粋な言語基盤

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/infrastructure-layer.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## このリポジトリの配置

`kernel/infrastructure`には、ドメインや外部システムを知らない純粋な言語拡張を置く。例は`Result`、Resultの合成、JSONの型、正準化・比較などである。

- domain・usecase・adapterへ依存しない。
- I/Oを持たない。NodeのI/O、プロセス起動、時計の実装、乱数、環境設定の読み込みはadapterへ置く。
- RPCクライアント・DBアクセス・Repository実装は、相手方や保存先の契約を知るためadapterに置く。
- 便利な共有部品という理由で、業務語彙や外部契約を最内層へ移さない。

移植元は汎用I/O機構もinfrastructureへ置くが、このリポジトリは既に純粋な最内層として運用している。一般原則の「言語基盤と外部契約を分ける」を引き継ぎ、I/Oの配置は現在の設計規則L4を維持する。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
