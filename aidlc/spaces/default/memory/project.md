# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- Testing Contract の plan_profile の層は実体に合わせて読み替える。DB と UI を持たないプロジェクトではその 2 層を落とし、Repository/data access を「層境界の解決経路」、Business logic を「境界を判定するアーキテクチャ規則」、API/endpoint を「出荷物の公開面」に対応づける。methodology（test-after）は変えない (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:96c411537b24832029e1062e57f0be7365e63962a2922bb16ec1bd8ccfaa6bf4 -->
- 生成物 tools/** をカバレッジ除外に足す必要はない。bun test --coverage の実測で tools/ は計測に一切現れない（すべて子プロセス実行で in-process 計測に乗らない） (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:57eb9aec2e61b3fedc35ffc15faed05ede60fabfcb030ba1107b3a8181f19f87 -->
## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

## Mandated

- **ドメインオブジェクトの種別規律（2026-09-02 オーナー裁定）**: domain 層に置くドメインオブジェクトは、エンティティ（ローカルエンティティ、または集約のルートエンティティ＝グローバルエンティティ）、値オブジェクト、配列やコレクションを隠すファーストクラスコレクション、ドメインイベント（ドメインで起きた出来事の不変の記録）のいずれかを基本とする。ドメインサービスを作るときは人間の裁定が必須。これ以外の種類のドメインオブジェクト（facts／materials／context／ledger／plan 型、随伴 static class、自由関数、例外型、generic record など）を実装したい場合は、必ず実測ありの問題と対策内容を添えて人間の裁定にかけ、裁定の後にだけ実装する。裁定の記録先は `deep-spec-analysis/docs/decisions.md`（および `.ja.md`）。
- **不変条件規律（2026-09-02 オーナー裁定）**: 整合性はエンティティ／値オブジェクトに不変条件として守らせる。検査手順をオブジェクトに包んだだけのドメインサービスは作らない。
- **識別規律（2026-09-02 オーナー裁定）**: コレクションからキーで検索される要素は識別が要るのでエンティティにする。値オブジェクトは識別できないものにだけ使う。
- **命名規律（2026-09-02 オーナー裁定）**: 「事実（facts）」という語はドメインイベント（成立した事態）以外に使わない。コンパイラの対応表や解釈材料は `*Plan` 等の実体に合う名にする。
- **ドメインエラー規律（2026-09-02 オーナー裁定）**: ドメインエラー型は domain 層のモデルだが、型とバリアントがユビキタス言語に対応づくこと。予期された失敗は例外で投げず `Result` の値で返す。
- **リードモデル規律（2026-09-02 オーナー裁定）**: CQRS のリードモデル（表示・照会のための投影）は domain 層に置かず usecase（クエリ側）に置く。
- **モデル委譲規律（2026-09-03 オーナー指示）**: Fable 5 のレートリミットを早期に使い切らないため、メインセッションは要件の明確化・設計・計画・監査・レビュー・最終的な統合判断に充てる。実装中は、見込まれる資源節約が調整コストを上回るときは常に、範囲の明確な実行タスクをサブエージェントへ委譲する。境界が明確な定型的実装は Sonnet に、強い推論を要する複雑または高リスクの実装は Opus に任せ、委譲が安全にも効率的にもできない例外的に難しい・密結合な作業だけ Fable 5 が直接行う。委譲のオーバーヘッドが見込まれる節約を上回る小さく範囲の明確なタスクはメインセッションに残す。委譲プロンプトは必ずスコープ・担当ファイル・受け入れ基準・検証手順を定め、書き込み範囲は重複させない。差分全体のレビュー、最終検証の確認、統合結果を受け入れるかの判断は Fable 5 のメインセッションが責任を持つ。

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- このリポジトリの Reverse Engineering は deep-spec-analysis/（プラグイン本体）に絞った focused scan（kind: partial）で行い、aidlc-workflows/ submodule・.claude/・sandbox・dist/・node_modules/ は解析対象にしない (learned 2026-09-03) <!-- cid:260903-src-bundle-split:reverse-engineering:cba9d7690d5523f4934a18d311df6e3805269efa858e95183375b3f2e3887da9 -->
- reverse-engineering-timestamp の Scope of Analysis は kind: partial と入れ子の analyzed.paths で正直に書き、fingerprint は mint の出力（このワークスペースでは unknown）を逐語で記録する。kind: full は全体を深く読んだときだけ (learned 2026-09-03) <!-- cid:260903-src-bundle-split:reverse-engineering:1d28ba619e1d057f1e356d3e1faae9441c67537a390e2747b7b7abf6c19c0798 -->
- codekb-snapshot と codekb-publish の paths は ./ にする（fingerprint ツールは入れ子パスを扱えない）。解析範囲は Scan Coverage と analyzed.paths で記録する (learned 2026-09-03) <!-- cid:260903-src-bundle-split:reverse-engineering:bbb8e0a131692644eff7e1f5822d4a1e6331c223fadcd6ecf09f92aed5e23568 -->
- intent を作ったら intents.json の repos を [] にする（sibling 自動検出が aidlc-workflows submodule を解析対象に登録してしまい、repos を変える verb が無いため） (learned 2026-09-03) <!-- cid:260903-src-bundle-split:reverse-engineering:2781acc6256db86eec86fbb8fa3bba4785f576fdce2bbafd9dafb3e991d6471c -->
- 要件を書くときは上流の「実行経路」まで確認する。codekb の「拡張子を見る工程は無い」は projection／validate／compose についての記述で、センサーのディスパッチと doctor は別経路だった。Reverse Engineering の記述の射程を要件へ持ち込むときは経路の同一性を確認する (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:0ac96743d45a5f070d8da0305c93b49acd500e44cbc307f3181146d87977a3c9 -->
- .ts の名を着た bundle 済み JS は node 24 の型ストリップでそのまま実行でき（--smt-child 経路 exit 0）、bun 実行では findings JSON・verdict 行が .js 名と byte 同一で凍結 golden にも一致することを実測した (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:ccfb19d6cd3f530735246a395bfa1739aa64e17c0e2bc6407a2be75178d50fdf -->
- NFR の閾値が実測と噛み合わないときは、閾値を通すために単位や解釈を選ばず、上限自体を裁定で見直す。bundle サイズ上限 300 KB → 512 KiB の見直しは design 系 entry（241 モジュール、最大 300,296 バイト）を織り込んでいなかったための修正 (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:c09d433b4b1cd0b5ca2c3c136bb320b8b7f4eea2f3367f124ae6eefe59b9298e -->
- bun build は出力先パスを変えても byte 不変で、ソースパスは cwd 相対で埋め込まれる（実測）。生成器は cwd を package root に固定してこの性質を守る (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:0085bbc5801281df69c24c12595e7f5400a0c7d5ba6c6454be0a419e44591699 -->
- アーキテクチャ規則の相対パス基点を tools/ から src/ に読み替えるとき、PUBLISHED_LANGUAGE の 11 鍵は同形なので無変更で済む。表の項目を足すのは裁定であって便宜ではないので、移行では鍵の形だけを揃え、増減防止に size の表明を置く (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:159106ae23117a55f740dc270acb33536648d2faf5f939143aa3edc5c99393e1 -->
- bun workspaces で層の依存境界を強制するとき、root package.json の dependencies に層を列挙してはいけない。未宣言の層からの bare import が root node_modules への上位探索で解決してしまい、実行時も tsc も検出できなくなる。tests を workspace メンバーにすると @deep-spec は tests/node_modules にだけ張られ、依存 0 の層からの import は Cannot find module になる（実測） (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:04eb1d805d5ef3f1794ba3a8c72a45a1e7924aebeae0937a6d00d734f5c5fda0 -->
- express スコープは units-generation を SKIP するので Code Generation は zero-Unit のステージ実行になる。成果物は construction/code-generation/ 直下に置き、Bolt／walking skeleton／per-Unit の儀式は走らせない (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:f9999d1ec586d07ff4b85d5d82bec7a399909e992164d2292a7e2d845470795e -->
- 多数のファイルを移設する大きな実装は、承認済み計画とマーカーを共通にしたまま依存順の波に分けてサブエージェントへ委譲する。16 ステップ・468 ファイルの移設を 1 回の委譲に載せると文脈が尽きる (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:0975393a4037974eb34bc0c3e415baece550b268358a7fddf9144a29c739f665 -->
- このプラグインの出荷物のファイル名は .ts のまま保つ。上流の aidlc-sensor.ts resolveScriptPath が manifest の command から .ts で終わるトークンを探して無ければ dispatchError で落ち、aidlc-utility.ts の doctor チェックも <plugin>-doctor.ts を決め打ちしている。配布経路（projection／validate／build／compose）に拡張子検査は 1 件も無いが、実行経路は .ts を要求する (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:68e5b756562ee67255a8fd13f60547a629a7f713c67f09f077551c32bb14747d -->
- 契約スキーマの原本は src/entries/data/ に置く。entry は dirname(import.meta.url) からの相対で data/ を引くため、原本を entries と同階層に置くとソースツリーと出荷形で相対規則が一致し、bun src/entries/<entry>.ts の直接実行も生きる (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:34f6443e2fde45ddea62c63d6391f91082c7f4a63f6440309a9abee395d2a4ce -->
- tools/ を src/ へ移設するときは import の置換だけでなく、data/*.json をファイルとして読むテストの schema 参照も同時に向け直す。片方だけでは移設後の緑判定ができない (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:24655d4801eaae6008574cd7d1dc8fa20390bad5e8d317448548d5ef829072ba -->
- アーキテクチャ規則に新しい判定を足すときは既存の判定を外さない。layer-direction は相対 import の方向判定を残したまま bare specifier の判定を追加した。相対判定を外すと既存 red/green example の検出力が落ちる。越境相対は新規則と二重に検出されてよい (learned 2026-09-03) <!-- cid:260903-src-bundle-split:code-generation:61cf5a906713ab4ee1bff1b0f8f87f4e97361d6164e696877b84052ec52d3371 -->
