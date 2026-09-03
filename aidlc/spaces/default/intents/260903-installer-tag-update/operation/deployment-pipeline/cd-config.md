# CD設定

## 目的

`deep-spec-analysis`をstable SemVer tagとして公開し、利用者がtagまたはlatest stable tagから再現可能に導入できる状態を作る。常駐環境へのデプロイは行わない。

## Triggerと実行主体

| Trigger | 実行内容 | 実行主体 |
|---|---|---|
| Pull Request | 型検査、全テスト、bundle drift、plugin validate、7 harness build | GitHub Actions |
| main push | PRと同じ品質検査 | GitHub Actions |
| `v*` tag push | 品質検査に加え、tagとmanifest versionの一致を検査 | GitHub Actions |
| release | `bun deep-spec-analysis/scripts/release.ts <version>` | maintainerが明示実行 |

## Release command

```bash
git switch main
git pull --ff-only
bun deep-spec-analysis/scripts/release.ts <stable-semver>
```

release scriptは次を一括実行する。

1. cleanな`main`、stable SemVer、local／remote tag未使用をpreflight
2. `.aidlc-plugin/plugin.json`のversion更新
3. 英語のrelease commit作成
4. `v<version>` tag作成
5. `git push --atomic origin main v<version>`

## Quality gates

- 全テスト: failure 0
- TypeScript: error 0
- bundle drift: 14 files up to date
- plugin validator: error 0
- 7 harness build: 全成功
- tag: `v<version>`とmanifest versionが一致

どれか1つでも失敗した場合は公開しない。production相当のtag公開にはmaintainerの明示操作を必要とする。

## Secretsと権限

- release scriptにcredentialを埋め込まない
- GitHubへのpush権限は実行者の既存git credentialを使う
- CI tokenの権限はcheckoutと検査に必要な最小権限とする

