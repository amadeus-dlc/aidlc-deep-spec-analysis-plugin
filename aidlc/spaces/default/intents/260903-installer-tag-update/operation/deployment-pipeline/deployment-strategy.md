# 配布戦略

## 戦略

配布単位はimmutableなstable SemVer Git tagとする。サービス向けのblue/green、canary、rollingは適用しない。各tagはmanifest versionと1対1で対応し、公開後に書き換えない。

## Promotion matrix

| 段階 | 入力 | Gate | 出力 |
|---|---|---|---|
| PR | feature branchの差分 | CI全項目green、review | mainへ統合可能な変更 |
| main | 統合済みcommit | main CI green | release candidate |
| stable tag | maintainerが指定したversion | release preflight、atomic push、tag CI | 利用者が取得できる公開版 |

## 利用者への展開

- 既定: installerがGitHub APIからlatest stable tagを解決
- 固定版: `--tag v<version>`
- 開発追従: `--ref <branch>`
- 更新: provenanceが記録したsourceの意味を維持して`--update`

## 承認

- PR mergeは通常のrepository reviewとrequired checksに従う
- tag公開はmaintainerがrelease commandを明示実行して承認する
- 自動production release、force push、既存tagの再利用は行わない

## Feature flag

実行時trafficや段階公開を持たないためfeature flagは使わない。互換性に問題がある変更は新しいmajor versionとして公開する。

## 成功確認

tag CIがgreenであること、manifest versionが一致すること、公開tagを指定したinstallerがvanilla AI-DLC projectへ導入できることを確認する。

