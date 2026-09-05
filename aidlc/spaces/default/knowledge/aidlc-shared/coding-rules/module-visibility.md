# モジュールの公開面をファサードで制御する

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/module-visibility.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 規則

- パッケージ外へ公開する型・関数は`index.ts`から明示的に再エクスポートする。`export *`は使わない。
- 同一パッケージ内は相対import、別パッケージからは`@deep-spec/<文脈>-<層>`の公開面を使う。
- 別パッケージの内部ファイルへの相対importで依存規則を迂回しない。
- 利便性だけを理由に、無関係なパッケージから型を再公開しない。既存の共有語彙の公開経路は、所有関係と許可された依存方向に従う。
- 1ファイル1公開型とする。関連する関数・定数は、その型の責務と一致するときに同居できる。
- パッケージ依存は`package.json`に明記する。宣言していない依存をルートの依存解決で補わない。

Rustの`mod`・`pub use`・クレート境界は、このリポジトリではTypeScriptのモジュール・明示的なファサード・bun workspaceのパッケージ境界へ対応づける。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
