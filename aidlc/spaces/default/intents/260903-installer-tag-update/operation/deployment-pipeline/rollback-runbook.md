# ロールバック手順

## 原則

公開済みtagは削除・移動・上書きしない。問題版を履歴から消すのではなく、原因commitをrevertし、新しいpatch versionとして修正版を公開する。

## 発動条件

- tag CIが失敗した
- 固定tag installerがmanifest検証、build、compose、doctorのいずれかで失敗した
- 既存利用者の`--update`でpayload互換性または`Changed 0`契約が壊れた
- Critical／Highの供給網またはpath traversal問題が判明した

## Tag公開前

release scriptのpreflightまたはatomic pushが失敗した場合、remoteへ部分公開されていないことを確認する。localにだけ作られたcommit／tagは原因を修正してから再試行し、同じversionをremoteへ公開済みなら再利用しない。

## Tag公開後

1. 問題のtag、症状、影響範囲を記録する
2. `main`で問題commitを`git revert`する。履歴を書き換えない
3. installer、doctor、release、intent E2E、全suite、7 harness buildを再実行する
4. manifestを次のpatch versionへ進める
5. `bun deep-spec-analysis/scripts/release.ts <new-patch-version>`を明示実行する
6. 新tagのCIと固定tag installerのsmoke testを確認する
7. READMEまたはrelease noteで問題版と推奨更新先を案内する

## 利用者側の一時復旧

provenanceに記録された問題版より前の既知正常tagを`--tag`で指定して再導入する。mutable branchやlatestの意味を黙って変更せず、復旧後のprovenanceを確認する。

## 禁止事項

- `git push --force`
- 公開済みtagの削除または別commitへの付け替え
- CI、manifest一致検査、path安全検査の無効化
- 失敗したcomposeに対する成功provenanceの手書き

## 完了条件

- 新しいpatch tagのCIがgreen
- vanilla projectへの固定tag導入が成功
- doctorのversion advisoryとprovenanceが新tagを示す
- 問題版からの更新手順が利用者へ通知済み

