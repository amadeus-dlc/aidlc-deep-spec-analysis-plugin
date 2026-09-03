# テスト結果

実行環境: macOS、Bun 1.3.13、Node.js 24系。

## 実行結果

| コマンド | 結果 |
|---|---|
| `bun test --coverage` | exit 0。527 pass / 1 skip / 0 fail、2,855 assertions、28 files、27.03秒 |
| `bunx tsc --noEmit` | exit 0 |
| `bun scripts/build-tools.ts --check` | exit 0。14 files up to date |
| `bun test ./.codex/hooks/aidlc-codex-adapter.test.ts` | 4 pass / 0 fail |
| `aidlc-utility.ts plugin-validate deep-spec-analysis --json` | `valid: true`、error 0 |
| 7 harness plugin build | 全て exit 0 |
| Claude vanilla `aidlc-plugin-test` | `CLEAN`、Drops 0、Idempotent=true |
| `git diff --check` | exit 0 |

skip 1件は opt-in の parity harness であり、通常suiteでは意図的に無効化されている。

## Coverage

`bunfig.toml` のdomain層 coverage floorを維持した。テストコマンドはfloor違反時に非0となるが、今回はexit 0だった。生成済み `tools/` は子プロセス実行のためin-process coverage対象外であり、byte driftとgoldenで検証する。

## セキュリティ結果

- archiveの絶対path、`..`、symlink、hard linkを拒否
- tag／manifest不一致、GitHub failure、builder欠落を導入先変更前に拒否
- compose失敗時に成功provenanceを保存しない
- secret patternの実値0件
- release preflight失敗時のgit mutation 0件

## Target Verification Matrix

最終判定は `build-and-test-summary.md` の同名表に記録した。NFR1〜NFR6とTesting Contract 3件はすべて `Met`、`Pending`／`Not Met`／`Unverified` は0件である。

## 失敗詳細

なし。失敗エスカレーションとloop-backは発動していない。

## Loop-Back Log

None.

