# セキュリティテスト手順

今回の攻撃面は、公開 archive、local path、manifest、導入先 filesystem、release用 git command である。認証・認可・常駐サービスは持たない。

## 実行コマンド

```bash
cd deep-spec-analysis
bun test tests/installer.test.ts tests/release.test.ts tests/architecture.test.ts
bun scripts/build-tools.ts --check
```

秘密情報らしい代入を確認する。

```bash
rg -n -i '(api[_-]?key|secret|password|token|BEGIN [A-Z ]*PRIVATE KEY)[[:space:]]*[:=]' \
  deep-spec-analysis/src deep-spec-analysis/tools deep-spec-analysis/scripts
```

## STRIDE観点

| 脅威 | 検証 |
|---|---|
| Tampering | path traversal、絶対path、symlink、hard link、tag／manifest不一致を拒否する |
| Repudiation | provenance に version、ref、source、installed_at、payload hash を原子的に記録する |
| Information Disclosure | secret pattern とエラー文に資格情報が含まれないことを確認する |
| Denial of Service | tags API を100ページ、1ページ100件に制限し、doctor client は5秒 timeout を持つ |
| Elevation of Privilege | plugin-owned path だけを refresh／tombstone 対象にし、外側を削除しない |

## 合格条件

- 悪意ある archive fixture がすべて導入先変更前に失敗する
- compose失敗後に成功 provenance が書かれない
- release preflight失敗時に commit／tag／push が実行されない
- hardcoded secret の実値が0件

