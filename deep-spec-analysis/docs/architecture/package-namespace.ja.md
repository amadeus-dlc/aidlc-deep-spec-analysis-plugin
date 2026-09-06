# ワークスペースのパッケージ名

日本語 | [English](package-namespace.md)

このプロジェクトのnpm形式のスコープ名は `@deep-spec-analysis` とする。ルートの `deep-spec-analysis-plugin-dev` は開発用ハーネス名であり、層パッケージとは区別する。

| 対象 | 名前 |
| --- | --- |
| 層パッケージ | `@deep-spec-analysis/<context>-<layer>` |
| 合成ルート | `@deep-spec-analysis/entries` |
| テスト | `@deep-spec-analysis/tests` |

18個のワークスペースパッケージはすべてprivateである。同じパッケージ内は相対import、別パッケージへは公開facadeをimportする。依存先は各package.jsonのdependenciesに `workspace:*` で宣言する。

同じパッケージをスコープ名で参照する例外12件も相対importへ統一した。`no-same-package-scoped-imports` と `no-cross-package-relative-imports` の両規則により、この使い分けを検査する。表記を合わせるために内部ファイルを外部へ公開することはしない。

## 既存チェックアウトの更新

旧スコープから更新したチェックアウトでは、Bun 1.3.13の通常の `bun install` や `--force` だけでは、各ワークスペースの古いリンクが残ることを確認した。旧名への互換リンクは提供しないため、`deep-spec-analysis/` で生成された依存リンクを再作成する。

```sh
bun - <<'TS'
import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

const scopes = ["src/*/*/package.json", "src/entries/package.json", "tests/package.json"]
  .flatMap((pattern) => [...new Bun.Glob(pattern).scanSync(".")])
  .map((manifest) => join(dirname(manifest), "node_modules", "@deep-spec"))
  .filter((scope) => existsSync(scope));
const links = scopes.flatMap((scope) => {
  if (!lstatSync(scope).isDirectory()) throw new Error(`Unexpected scope path: ${scope}`);
  return readdirSync(scope, { withFileTypes: true }).map((entry) => {
    if (!entry.isSymbolicLink()) throw new Error(`Unexpected non-link: ${scope}/${entry.name}`);
    return join(scope, entry.name);
  });
});
for (const link of links) unlinkSync(link);
for (const scope of scopes) rmdirSync(scope);
TS
bun install --frozen-lockfile
bun run check
bun run typecheck
bun test tests/package-boundaries.test.ts
```

上記は旧スコープ配下の全要素がシンボリックリンクであることを先に確認し、そのリンクと空になったディレクトリだけを削除する。新しいスコープ・依存ストア・ソースは対象にしない。新しいチェックアウトでは通常の `bun install --frozen-lockfile` だけでよい。

パッケージ境界テストは、新名での解決、旧名の拒否、未宣言依存の拒否、公開していない深いパスの拒否を、実行時と型検査時の両方で確認する。旧名が残る過去の監査・設計判断・学習記録は当時の記録であり、現行のimportや互換APIではない。
