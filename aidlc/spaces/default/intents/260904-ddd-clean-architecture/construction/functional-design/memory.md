<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-04T01:41:28Z — 選択肢の推奨には対象コードの静的根拠だけでなく、失敗・並行性に関する主張なら故障注入または同等の実測を添える。実測できない保証は設計上の限界として明記し、選択肢を推奨扱いにしない。
- 2026-09-04T03:14:09Z — `conformedOf`は既存裁定どおりRepository境界に維持し、Finalizerが一度だけ呼んだ適合済みreportを`storeConformed`へ渡す。productionの実測は3 repository実装、7 usecase呼出し、3 store内再評価であり、今回は全体の境界反転ではなく二重評価を除去する。
- 2026-09-04T03:14:09Z — zero-UnitはUnits Generationの実行状態ではなく解決済みUnit集合が0件であることを条件とし、質問、review confirmation、traceabilityで同じstage-level判定を共有する。

## Deviations

- 2026-09-04T01:41:28Z — 当初の`backup付きrollback`推奨を、故障注入後に撤回した。捕捉可能な例外では旧ペアへ戻せたが、最初のrename直後のクラッシュ相当では`backend=new / cross-check=old`が残り、推奨に必要な保証を満たさなかった。

<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-04T03:14:09Z — Directory lockは待機なし、128-bit以上のowner token、30秒leaseを採る。64 KiB二文書のtemp＋rename 1,000回はp99 0.534 ms、最大2.026 msだったが、leaseは速度目標ではなく遅いfilesystem上でlive writerを誤解除しない安全余裕として長く取る。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-04T03:51:55Z — released lockをcanonical pathのまま削除すると後続ownerのlockを消せるため、owner固有cleanup pathへのatomic renameが必要。
- 2026-09-04T03:51:55Z — `DesignVerificationAcquirer`のterminal結果は`VerifyDesignOutcome`全体ではなく、取得処理が生成できる5 variantだけへ型で限定する必要がある。
