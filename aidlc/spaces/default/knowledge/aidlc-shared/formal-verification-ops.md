# 形式検証バックエンドの設計と運用（z3・quint・Apalache）

このプラグインのソルバーは決定論（同じ入力から byte 同一の findings）を契約にしている。その前提で確立した設計判断と、2026-09-03 に実測で突き止めた Apalache の孤児化問題をまとめる。一次資料は `docs/decisions.ja.md` のスパイク結果（A1〜A4）と issue #128。

## 1. 固定版は裁定事項

`deep-spec-analysis/package.json` の `@informalsystems/quint` と `z3-solver` は exact pin で、golden（`tests/fixtures/*/expected/*.json`）はその版の出力を byte 凍結している。版を上げることは golden を更新する裁定であって定期バンプではない。Renovate はこの 2 つを「solver backends」に束ねて Dependency Dashboard での承認制にしてある（`renovate.json`）。`mise.toml` の bun／node は CI（`setup-bun`／`setup-node`）と同じ版に揃える。

## 2. z3（SMT）は必ず子プロセス

`z3-solver` の WASM は bun 上で Emscripten pthread の起動アサーションで即死する（5.2.0／4.15.8 とも、bun 1.3.13）。node 24 では全機能（unsat / sat＋モデル / unsat core / `fromString`）が動く。よって SMT バックエンドはソルバー実行を常に子プロセスへ隔離し、node 優先・bun フォールバック、どちらも不可なら契約 2 の `unavailable` に閉じる。node ≥ 23 が PATH に要るのはこのため。

## 3. quint の決定論

`quint run --seed` でトレース内容は決定論的だが、ITF の `#meta`（timestamp／description）は実行毎に変わるので witness 格納時に全部剥がす。bounded（`quint verify`、Apalache）と simulation（`quint run`）の切替は `AIDLC_DEEP_SPEC_QUINT_METHOD=auto|bounded|simulation`。CI は JVM が無いので simulation、bounded は実サンドボックスで実射する。capability skip（When-event 付き scenario、全属性の束縛が要る scenario）は仕様上の限界であって環境障害ではない。

## 4. Apalache サーバの寿命と孤児化（issue #128、2026-09-03 実測）

quint 0.32 の `connect()`（`dist/src/apalache.js`）の挙動:

1. 既定ポート **8822** に既存サーバがあれば再利用する（"Connecting with existing Apalache server"）
2. 無ければ `apalache server --port=8822` を `child_process.spawn` する。`detached` なし、cwd は quint の cwd を継承
3. 子を SIGTERM する終了ハンドラは quint 自身の `exit` / `SIGINT` / `SIGUSR1` / `SIGUSR2` / `uncaughtException` に付く。**SIGTERM には付かない**

センサー側の `QuintClientImpl.#runQuint` は `spawnSync(quint, …, { timeout, cwd: <mkdtemp の一時ディレクトリ> })` で、タイムアウト時の killSignal は既定の SIGTERM。したがって:

- verify がタイムアウト → quint は終了ハンドラを走らせずに死ぬ → **Apalache が一時ディレクトリを cwd にしたまま孤児化**
- センサーが一時ディレクトリを `rmSync` → 孤児は消えたディレクトリを掴んだまま生き続ける
- 以後のあらゆる `quint verify` は既存サーバとして孤児に接続し、サーバが `<消えた cwd>/_apalache-out/server/<起動時刻>/log2.smt (No such file or directory)` で失敗する。プラグインと無関係な 5 行の spec でも失敗する

**症状**: `deep-spec-verify-quint` の findings で OB 群が `skipped[].reason="unavailable"`（生エラー付き）になり、Apalache を経由しない scenario だけが残る（期待 2 件が 1 件になる等）。センサー自体はクラッシュせず沈黙もしない——それが仕様。

**診断**（どれか 1 つで足りる）:

- `lsof -nP -iTCP:8822 -sTCP:LISTEN` で listen 中の `java … apalache.jar server` を見る。起動時刻が古く、コマンドラインの cwd 由来のパスが消えていれば孤児
- trivial spec を `quint verify` して失敗し、`--server-endpoint=localhost:8823` で新規サーバを立てると同じ spec が `[ok] No violation found` になれば、サーバ側の問題と確定

```
module probe {
  var x: int
  action init = { x' = 0 }
  action step = { x' = x + 1 }
  val inv = x >= 0
}
```

**修復**: 孤児を `kill <pid>` する。quint は次回の verify で自動的にサーバを立て直す。

**設計上の対策**（#128、実装済み）: (1) `#runQuint` は quint を **`killSignal: "SIGINT"`** で止める——quint 自身の後始末ハンドラが走り、Apalache もろとも終わる。予算超過の判定は `res.error.code === "ETIMEDOUT"` を第一の証拠にする（SIGINT を処理した quint は自分で exit するので `signal` は null になりうる。旧来の `signal === "SIGTERM"` 判定だと中断された検証をクリーンと誤読する）。当初案の `detached: true` ＋ 負 pid へのグループ kill は採れない——**bun 1.3.13 の `spawnSync` は `detached` を無視する**（子の pgid が親のまま。node 24 は尊重する）ので、bun で走るセンサーでは送るべきグループが存在しない。残る危険は、SIGTERM を無視する JVM があると quint のハンドラがそこで待ち `spawnSync` が止まること。ディスパッチャのセンサー予算（`timeout_seconds` 75／85）が上限になる。(2) doctor は静的判定（JDK＋`~/.quint/apalache-dist-*`）に加え、**8822 に listen 中のサーバがあるときだけ** trivial spec を verify し、失敗なら stale として `Apalache available` 行を fail にし、`fix` に停止手順を出す。listen していなければ probe しない（doctor に JVM 起動コストを持ち込まない。実測: 待ち受けなし 0.23 秒、実サーバ相手 0.43 秒）。listen 判定は `availability()` を同期に保つため、entry が注入したランタイム（`process.execPath`）の子プロセスで `node:net` の connect を試す。

## 5. サンドボックス実射の読み方

- 実射は必ず実ディスパッチャ（`.claude/tools/aidlc-sensor.ts fire <id> --stage <slug> --output-path <path>`）経由で行う。センサーの outcome は advisory なので、exit code が非 0 になるのは dispatch エラーだけ。
- ディスパッチャの detail md は **active intent** の `.aidlc-sensors/` に落ちる。別 intent の成果物に発火するときは先に intent を切り替える（doctor の `fix` 文字列がその順で書いてある）。findings JSON は成果物の隣の正しい場所に出る。
- 期待値の基線は `docs/decisions.ja.md` の実射行（例: intent-e2e fixture で ir-valid pass／SMT 5 件／Quint 2 件／cross-check {SC-3, SC-5}）。
