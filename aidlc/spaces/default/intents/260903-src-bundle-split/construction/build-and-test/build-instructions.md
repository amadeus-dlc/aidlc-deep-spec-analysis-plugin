# ビルド手順 — deep-spec-analysis プラグイン

対象は `deep-spec-analysis/`（ワークスペースルート直下）。`src/` がソース、`tools/` が
`scripts/build-tools.ts` の生成物という配布モデル（`code-generation-plan.md` の Step 1〜8）
に対応する。

## 前提条件

| 依存 | 版 | 固定元 | 無いとどうなるか |
|---|---|---|---|
| bun | 1.3.13 | `mise.toml`、CI の `setup-bun` | ビルド・テスト・生成器のすべてが動かない |
| node | 24（>= 23） | `mise.toml`、CI の `setup-node` | SMT バックエンドの子プロセスが起動できず `unavailable` に縮退する |
| `@informalsystems/quint` | 0.32.0（exact pin） | `package.json` devDependencies | Quint バックエンドが `unavailable` に縮退する |
| `z3-solver` | 5.2.0（exact pin） | `package.json` devDependencies | SMT バックエンドが `unavailable` に縮退する |
| JDK 17+ | — | 環境 | `quint verify`（bounded）が使えず simulation に落ちる |

ソルバー 2 本は exact pin で、golden がその版の出力を byte 凍結している。版を上げることは
golden を更新する裁定であって定期バンプではない。

## 依存のインストール

```bash
cd deep-spec-analysis && bun install --frozen-lockfile
```

`bun.lock` は `src/` のパッケージ化（17 層＋`entries`＋`tests` の workspace メンバー）に
伴って再生成済み。CI は `--frozen-lockfile` なので、`package.json` を触ったら
`bun install` して lock をコミットすること。

`bunfig.toml` の `[install] linker = "isolated"` により、`@deep-spec/*` は宣言した
パッケージの `node_modules/` にだけ張られる。root には 1 つも入らない——これが
依存境界の強制の実体なので、root `package.json` の `dependencies` に `@deep-spec/*` を
足してはいけない。

## 環境設定

- 環境変数は不要（既定でビルドできる）
- `AIDLC_DEEP_SPEC_QUINT_METHOD=auto|bounded|simulation` は Quint の切替。既定 `auto`
- 秘密情報・API キーは一切使わない

## ビルド

```bash
cd deep-spec-analysis && bun scripts/build-tools.ts
```

`src/entries/*.ts` 10 本をそれぞれ
`bun build --target=bun --external z3-solver --sourcemap=none` で 1 本ずつ束ね、
`src/entries/data/*.json` 4 本を `tools/data/` に同期する。code splitting なし、minify なし。
生成器は cwd を package root に固定する（bundle にはソースパスが cwd 相対で埋め込まれるため、
これが byte 決定論の前提）。

出力は `tools/` の 14 ファイル: bundle 10 本（`<entry>.ts`）＋`data/` 4 本。

**出荷物のファイル名が `.ts` なのは上流ディスパッチャの契約**である。
`aidlc-workflows/core/tools/aidlc-sensor.ts` の `resolveScriptPath` は manifest の
`command` から `.ts` で終わるトークンを探し、無ければ `dispatchError` で落ちる。中身は
bundle 済み JavaScript で、bun も node 24（型ストリップ）も実行できる。

## ビルドの検証

```bash
cd deep-spec-analysis && bun scripts/build-tools.ts --check
```

一時ディレクトリに再生成してコミット済み `tools/` と byte 比較する。差分があれば
差分ファイル名を出して非ゼロ終了する。CI では typecheck の直後に走る。

```bash
cd deep-spec-analysis && bunx tsc --noEmit
```

`tsconfig.json` の `include` は `["scripts/**/*.ts", "src/**/*.ts", "tests/**/*.ts"]`。
**生成物 `tools/` は含めない**——bundle 済み JS を型検査すると壊れる。

## プラグインの検証と配布ビルド

```bash
cd deep-spec-analysis
bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .
for h in claude codex copilot cursor kiro kiro-ide opencode; do
  bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . "$h"
done
```

`dist/<harness>/tools` は 14 ファイルになる。`compose-hook-absent` の warning 1 件は
既存で、`Errors: 0` なら VALID。

## 導入先への配置

```bash
cd deep-spec-analysis && bun scripts/install.ts --project <project>
```

projection ビルド → upgrade refresh（同名ファイルの置換）→ tombstone（層ディレクトリ 6 本の
再帰削除）→ no-clobber compose → doctor。冪等。

## よくあるビルドの失敗

| 症状 | 原因 | 対処 |
|---|---|---|
| `--check` が差分を報告する | `src/` を触って `tools/` を再生成していない | `bun scripts/build-tools.ts` を実行してコミットする |
| `Cannot find module "@deep-spec/..."` | その層をパッケージの `dependencies` に宣言していない | 依存として正しければ `package.json` に足して `bun install`。正しくなければ層をまたぐ設計を見直す |
| `tsc` が `tools/` を拾って大量のエラー | `tsconfig.json` の `include` に `tools/` を足してしまった | `include` から外す |
| SMT が `unavailable` に縮退する | node が PATH に無い、または `z3-solver` が入っていない | node 24 を入れる／`bun install` |
| Quint が `unavailable`（無関係な spec でも失敗） | 8822 に孤児 Apalache サーバが残っている | `lsof -nP -iTCP:8822 -sTCP:LISTEN` で pid を見て `kill`。quint が次回自動で立て直す |
| CI が `--frozen-lockfile` で落ちる | `package.json` を変えて lock を更新していない | `bun install` して `bun.lock` をコミット |
