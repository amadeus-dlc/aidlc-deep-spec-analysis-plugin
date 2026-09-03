# Deployment Pipeline Questions

## Q1 — 配布方式

この成果物は常駐サービスではなくGit tagから取得されるプラグインであるため、blue/green、canary、rollingは適用せず、stable SemVerのimmutable tagを公開単位とする。

[Answer]: Immutable Git tag release

## Q2 — 昇格経路

PRで全CIを通し、mainへ統合後、maintainerがrelease scriptを明示実行してtagを公開する。dev／staging／production環境は作らない。

[Answer]: PR → main → stable tag

## Q3 — 本番承認

`scripts/release.ts <version>`の実行を人間の本番承認とする。scriptはcleanなmain、stable SemVer、未使用tagをpreflightし、commitとtagをatomic pushする。

[Answer]: Manual maintainer approval

## Q4 — ロールバック

公開済みtagの削除・上書きやforce pushは行わない。不具合commitをrevertし、全検証後に新しいpatch versionを同じrelease scriptで公開する。

[Answer]: Revert and publish a new patch tag

## Q5 — Feature flag

実行時サービスや段階的traffic shiftがないためfeature flagは導入しない。

[Answer]: None

## Consolidated Summary Confirmation

- 配布物: `deep-spec-analysis` plugin sourceのstable SemVer tag
- 昇格: PRのCI → main → maintainerの明示release
- 公開: release commitとtagを`git push --atomic`で同時反映
- 復旧: tagを変更せず、revert後に新しいpatch tagを公開
- 対象外: 環境別promotion、traffic shift、feature flag

[Answer]: Looks correct
