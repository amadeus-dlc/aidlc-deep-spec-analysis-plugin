<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-03T09:21:25Z — 要件を書くとき上流の「実行経路」を確認していなかったのが原因; codekb の architecture.md の「拡張子を見る工程は無い」は projection／validate／compose についての記述で正しく、センサーのディスパッチと doctor は別経路だった。RE の記述の射程を要件へ持ち込むときは経路の同一性を確認する。
- 2026-09-03T09:21:25Z — .ts 名の bundle の安全性を実測で確定した; node 24 は型ストリップで .ts 名の JS bundle をそのまま実行でき（--smt-child 経路 exit 0）、bun 実行では findings JSON・verdict 行が .js 名と byte 同一、smt.json は凍結 golden と一致した。
- 2026-09-03T08:24:42Z — NFR4 の bundle サイズ上限を 512 KiB に見直した（オーナー裁定）; 当初の 300 KB は requirements 系 entry だけの実測に基づいており、241 モジュールを束ねる design 系（最大 300,189 バイト）を織り込んでいなかった。単位の解釈次第で 189 バイト差で落ちる脆いゲートになるため、閾値を通すために単位を選ぶのではなく上限自体を裁定で見直した。requirements.md の NFR4 に経緯ごと記載。
- 2026-09-03T08:24:42Z — bun build は出力先パスを変えても byte 不変で、ソースパスは cwd 相対で埋め込まれる（実測）; 生成器は cwd を package root に固定してこの性質を守る。A1 は成立。
- 2026-09-03T08:12:17Z — 規則関数の相対パス基点は src/ に読み替えた; 旧 tools/ 相対と同形になるため PUBLISHED_LANGUAGE の 11 鍵は無変更で済み、ENTRY_FILES だけが entries/<name>.ts 形式になった。表の項目は増減させていない（増減防止に size===11 の表明を追加）。
- 2026-09-03T08:01:48Z — Step 1.10 は「tests を workspace メンバーにする」を採用した; 実測で root package.json の dependencies に層を列挙する既定案は、未宣言の層からの bare import が root node_modules への上位探索で解決してしまい FR1.3／NFR5 の検出が無効になった。tests をメンバーにすると @deep-spec は tests/node_modules にだけ張られ、依存 0 の層からの import が Cannot find module になることを実ツリーで確認した。
- 2026-09-03T07:47:25Z — express は units-generation を SKIP するので zero-Unit のステージ実行として扱った; 成果物は construction/code-generation/ 直下に置き、Bolt／walking skeleton／per-Unit の儀式は走らせていない。
- 2026-09-03T07:47:25Z — Testing Contract の plan_profile の層を本プロジェクトに読み替えた; DB と UI の層は実体が無いので落とし、Repository/data access を「層境界の解決経路」、Business logic を「境界を判定するアーキテクチャ規則」、API/endpoint を「entry の bundle（出荷物の公開面）」に対応づけた。methodology は test-after のまま変えていない。
- 2026-09-03T07:47:25Z — Part 2 の委譲を依存順の波に分けた（1〜5／6〜7／8〜9／10〜13／14〜16）; 468 ファイルの移設と 16 ステップを 1 回の委譲に載せると文脈が尽きるため。承認済み計画とマーカーは共通で、波ごとに担当を立てる。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-03T09:21:25Z — 出荷物の拡張子を .js から .ts へ戻す（オーナー裁定）; 上流の aidlc-sensor.ts resolveScriptPath が command から .ts トークンを探して無ければ dispatchError で落ち、aidlc-utility.ts の doctor チェックも <plugin>-doctor.ts を決め打ちしている。配布経路（projection/validate/build）に拡張子検査は 1 件も無いが実行経路が .ts を要求するため、「upstream の契約は変えない」制約と両立するのは出荷物名を .ts に保つこと。要件 FR2.1／FR2.4／FR3.1／FR4.1〜FR4.3／FR4.5／FR5.2／FR5.3／NFR2 と FR6.2 を裁定に合わせて改訂した。
- 2026-09-03T08:36:46Z — 契約スキーマの原本を src/data/ から src/entries/data/ へ移す（計画 Step 8.3 は src/data/ と書いていた。オーナー承認済み）; entry は import.meta.url からの相対で data/ を引くため、原本を entries と同階層に置くとソースツリーと出荷形で相対規則が一致し、bun src/entries/<entry>.ts の直接実行も生きる。src/ は配布されない（plugin.json の contributes は stages/contributions/sensors/knowledge/tools のみ）ので配布への影響は無い。計画ファイルは Plan Approval の fingerprint 対象なので編集せず、この逸脱は memory.md と code-summary.md に記録する。
- 2026-09-03T08:01:48Z — Step 4 の範囲を import 置換から広げ、tools/data/*.json をファイルとして読む in-process テスト 9 本の schema 参照を src/data に向け直した; git mv で全て赤になり、そのままでは Step 5 の緑判定ができなかったため。spawn 先の toolsDir は触っていない（Step 11 の範囲）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-03T08:24:42Z — 生成物 tools/** を coveragePathIgnorePatterns に足さなかった; bun test --coverage の実測で tools/ は計測に一切現れない（すべて子プロセス実行で in-process 計測に乗らない）ため、除外を足す必要が無かった。Step 13.3 は実測により no-op。
- 2026-09-03T08:12:17Z — layer-direction は相対 import の方向判定を残したまま bare specifier の判定を追加した; 相対判定を外すと既存 red/green example の検出力が落ちて FR5.3 の「既存規則を維持」に反するため。越境相対は新規則と二重に検出される。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
