# 設計規則 — DDD とクリーンアーキテクチャ

日本語 | [English](design-rules.md)

この文書は `deep-spec-analysis/src/`（6 文脈・489 ファイル・26,007 行）を全ファイル読んで書き起こした、**いま実際に効いている**設計規則である。「こうありたい」ではなく「こう書かれている」を先に確定し、そこから規範を抜き出した。

他の AI-DLC プラグインでも同じ形を使えるように書いてある。移し方は §9、このリポジトリに残っている逸脱は §8。

## 読み方

規則は 6 群に分かれ、それぞれ接頭辞を持つ。

| 接頭辞 | 対象 |
|---|---|
| `L` | 構造——文脈と層、依存の向き |
| `D` | ドメイン層の住人 |
| `P` | 境界——port と usecase |
| `A` | 外界——adapter と entry |
| `F` | 失敗の表現 |
| `N` | 名前とファイル |

各規則は次の形で書く。

- **規則** — 判定可能な述語として書く。読む人が違っても同じ判定になることを狙う。
- **なぜ** — その規則が防いでいるもの。
- **実例** — このリポジトリの実在するコード。パスと**シンボル名**で指す（行番号は腐るので使わない）。
- **検査** — 機械検査があるなら規則名、無いなら「なし（レビュー）」。全 20 件の検査の内訳は [`enforcement.ja.md`](enforcement.ja.md)。

「検査: なし」の規則は弱いのではなく、**人が読んで守る**という意味である。機械検査は 20 件あり、いま全部緑で通っている（`bun test tests/architecture.test.ts` → 38 pass / 0 fail）。

---

## 0. この設計が答えている問題

このプラグインは、要件・設計文書を形式検証して**バイト単位で凍結された findings 文書**を出す。外から見える契約は 4 つあり、出力は同じ入力から必ず同じ byte になる。ソルバー（z3・quint・Apalache）は落ちるし、タイムアウトするし、環境によっては存在しない。文書は人間が手で書くので壊れている。

この 3 つ——**凍結された出力契約**・**信頼できない外部プロセス**・**壊れた入力**——が、以下の規則のほぼ全部の理由になっている。同じ性質を持たない領域では、いくつかの規則は過剰になる。§9 でそれを見分ける。

---

## 1. 構造 — 文脈と層（L）

### L1 — 文脈 × 層の二次元で切る

**規則**: ソースは `src/<文脈>/<層>/` の二次元で置く。文脈は業務上の関心（このリポジトリでは `requirements` / `design` / `refcheck` / `doctor` と、共有の `kernel`）。層は `domain` / `usecase` / `adapter` と、依存を持たない `infrastructure`。合成ルートだけが `src/entries/` に平置きされる。

**なぜ**: 層だけで切ると、無関係な業務が同じディレクトリに溜まる。文脈だけで切ると、依存の向きを機械で見られない。二次元にすると、どちらも保てる。

**実例**: `src/design/domain/`、`src/requirements/adapter/`、`src/kernel/infrastructure/`。分類できないファイルは 1 つも無い（`architecture.test.ts` が `locationOf` の未分類ゼロを固定している）。

**検査**: `one-public-type-per-file`（entry・data の位置も含めて判定）、および `locationOf` 未分類ゼロの表明。

### L2 — 層は独立したパッケージで、依存は manifest に宣言する

**規則**: 各 `src/<文脈>/<層>/` は `package.json` を持つ独立したパッケージ（`@deep-spec/<文脈>-<層>`）とする。他の層を使うなら `dependencies` に `"workspace:*"` で宣言する。宣言していない層は import できない。

**なぜ**: 「依存の向き」を注意力ではなくパッケージ解決に守らせる。宣言を消せば import が壊れるので、境界が実行時に効く。

**実例**: `src/kernel/infrastructure/package.json` は `dependencies` を持たない（依存ゼロ）。`tests/package-boundaries.test.ts` が、未宣言の層への import が**実行時に `Cannot find module`、型検査で `TS2307`** になることを実測で固定している。

**要件**: bun workspaces＋`bunfig.toml` の `[install] linker = "isolated"`。これが無いと未宣言の層がルートの `node_modules` から解決されてしまい、境界が無効になる。

**検査**: `manifest-dependency-direction`（`package.json` 側）と `layer-direction`（コード側）。同じ許可表を両方に適用する。

### L3 — 依存は内向きにしか向かない

**規則**: 許される向きは `entry → adapter → usecase → domain → kernel-domain → kernel-infrastructure` だけ。逆向きと飛び越しの一部は禁止。文脈をまたぐ辺は**明示の許可表**に載っているものだけ。

**なぜ**: クリーンアーキテクチャの依存規則そのもの。許可表を持つことで、「例外を作った」という事実が表に残る。

**実例**: 文脈横断の許可は現在 **1 本だけ**——`design/domain → requirements/domain`（設計が要件の語彙を参照する）。`SANCTIONED_CROSS_CONTEXT` に 1 エントリとして書かれている。

**検査**: `layer-direction` ＋ `manifest-dependency-direction`。

### L4 — kernel は共有語彙、`kernel/infrastructure` は依存ゼロ

**規則**: 複数の文脈が使う語彙は `kernel/domain` に置く。`kernel/infrastructure` には**ドメイン語彙を持たない純粋な計算基盤だけ**を置き、`node:*` を含むいかなる依存も持たせない。

**なぜ**: `Result` や正準 JSON 化のような道具は、ドメインの言葉ではないがドメインが使う。最内層に依存ゼロで置くことで、domain から使っても向きが壊れない。

**実例**: `src/kernel/infrastructure/` は `result.ts`（`Result` / `ok` / `err` / `unreachable`）、`json.ts`、`schema.ts`、`canonical-json.ts` だけ。`node:` の import は 0 件。

**検査**: `no-io-in-pure-layers`（`infrastructure` は `node:*` 全面禁止）。

### L5 — I/O とプラットフォーム API は adapter と entry にだけ置く

**規則**: `node:fs` / `node:child_process` / `node:os` / ネットワークは adapter にだけ置く。`process.*` と `import.meta` は entry にだけ置く。domain と usecase は 1 件も持たない。

**なぜ**: domain と usecase をテストで駆動できるようにする。ここが崩れると、ドメインの判断を確かめるのにファイルシステムが要る。

**実例（実測）**: `node:*` を import するファイル数は adapter 27・entries 10・usecase 0・infrastructure 0・domain 1。domain の 1 件は `src/kernel/domain/content-hash.ts` の `node:crypto`（副作用のない計算だが、字義通りの例外——§8 参照）。

**検査**: `no-io-in-pure-layers`、`process-only-in-entries`。

### L6 — 合成ルートは entry だけ、entry は配線だけ

**規則**: 実装クラスを `new` して依存を組み立てるのは entry だけ。entry は 3 層すべてに触ってよいが、業務判断を 1 行も持たない。逆に、entry を import してはならない。

**なぜ**: どの実装が使われているかが 1 ファイルに集まる。テストは別の実装を差し込める。

**実例**: `src/entries/` の 10 本はすべて同型——フラグ解析 → 対象外なら pass-through → 依存を組む → usecase を実行 → 判定を 1 行の JSON で stdout、exit code で伝える。

**検査**: `no-entry-imports`（誰も entry を import できない）、`process-only-in-entries`。

### L7 — 公開面は facade の明示列挙だけ

**規則**: 各パッケージの外から見えるのは `index.ts` が明示列挙した名前だけ。`export *` を使わない。他パッケージの内部ファイルへ直接 import しない（bare specifier で facade を通る）。同じパッケージ内は相対 import（`.ts` 拡張子つき）。

**なぜ**: 何が公開契約なのかを 1 ファイルで読めるようにする。`export *` は、ファイルを足した瞬間に無自覚に公開面が広がる。

**実例**: 全 `index.ts` の冒頭に「明示列挙のみ（`export *` 禁止）」と書かれ、実測でも `export *` 宣言は 0 件。深いパスの import は `package.json` の `exports` が `"." : "./index.ts"` だけなので解決に失敗する。

**検査**: `no-export-star`、`no-cross-package-relative-imports`。

---

## 2. ドメイン層の住人（D）

### D1 — domain に置いてよいのは 4 種のドメインオブジェクトとドメインエラー

**規則**: domain 層に置くのは、エンティティ（ローカル、または集約ルート）・値オブジェクト・ファーストクラスコレクション・ドメインイベント・**ドメインエラー**のいずれか。これ以外の種類（データ保持だけの型、手続きを包んだだけの型、static だけのクラス、自由関数）を置きたくなったら、**実測ありの理由を添えて人間の裁定にかけ、裁定の後にだけ置く**。

**なぜ**: 「何を作るか」を毎回考えると、貧血なデータ構造と手続きの山に戻る。種別を先に決めておくと、設計の議論が「この概念はどれか」に収束する。

**実例（実測）**: domain 層の `export class` は design 121・requirements 65・refcheck 79・doctor 11・kernel 25 の**計 301**。大半は値オブジェクトとファーストクラスコレクションで、集約ルートは Repository port を持つものに限られる（design は 5 つ）。**static メソッドだけのクラスは 5 文脈とも 0 件、ドメインイベントも 0 件**（§8）。

**検査**: `no-data-models-in-domain`（後述 D5）が最も効く。種別そのものの検査は無い（レビュー）。

### D2 — フィールドは `#private` だけ

**規則**: domain のクラスのインスタンスフィールドは JavaScript の `#` プライベートフィールドで宣言する。TypeScript の `private` / `protected` / `public` 修飾子は使わない（`private constructor` を除く）。原則として `readonly` を付ける。参照先の可変性は別に防ぐ。共有する式の木は `ExpressionTree` が入力をコピーして深い階層まで凍結し、`Expression` の型も再帰的にreadonlyにする。

**なぜ**: TS の `private` は型検査だけで、実行時には素通りする。`#` は言語が守る。「見えない」ことを本当に保証すると、外から中身を取り出して外で判断する道が塞がる。

**実例（実測）**: `src/` 全体で `private constructor` 以外の `private` キーワードは **0 件**。

**検査**: `domain-fields-are-private`。

### D3 — コンストラクタは private、生成は静的ファクトリだけ

**規則**: domain のクラスは `private constructor` を持ち、`new` を外に出さない。生成は名前のついた静的ファクトリを通す。

**なぜ**: 生成の意味（検証つきか、逐語か、どの変種か）を名前で表せる。コンストラクタは 1 つしか持てないが、門はいくつでも作れる。

**実例（実測）**: domain 層の `export class` 301 個に対し `private constructor` 302 個——例外ゼロ。

**検査**: `private-constructor-in-domain`。

### D4 — 生成の門は三つに分ける

**規則**: 静的ファクトリの名前は役割で決める。

| 名前 | 入力 | 検証 | 戻り値 |
|---|---|---|---|
| `of` | すでに型のついた値 | しない（型が保証済み） | 値そのもの |
| `parse` | 未検証の生値 | **する** | `Result<T, E>` |
| `reconstitute` | **書かれた文書**の生値 | **しない**（逐語で運ぶ） | 値そのもの |

閉じた集合の枝は、これに加えて枝ごとの名前つきファクトリを持つ（`SkipReason.timeout()` など）。

**なぜ**: これが**この設計で最も効いている規則**である。「厳格な生成」と「寛容な復元」を型の同じ場所に並べて書くことで、壊れた文書を読むときに何が起きるかが一目で分かる。壊れた値を `parse` で拒否すると、検査が「壊れている」と**報告**できなくなる——だから復元は逐語で通し、判断は検査に任せる。

**実例**: `src/kernel/domain/skip-reason.ts` の `SkipReason.parse`（閉集合 9 値の門）と `SkipReason.reconstitute`（未知の値も逐語で保持）。`src/requirements/domain/verification-finding.ts` の `VerificationFinding.of`（検証済み `FindingKind` だけ受ける）と `.reconstitute`（未知の kind も文字列で運ぶ）——`src/refcheck/domain/finding.ts` に**コメント文まで逐語同一の対**がある。

**実測**: domain 層で `of` 137・`reconstitute` 143・`parse` 48。

**検査**: なし（レビュー）。

### D5 — domain にデータモデルを置かない

**規則**: domain 層に、プロパティを持つ公開 `interface` や公開オブジェクト型（`export type X = { … }`、判別共用体を含む）を置かない。**メソッドが添えてあっても免除しない。**

**なぜ**: 公開のデータ形は、外から中身を読んで外で判断する招待状になる。振る舞いを持たせられない形は、持たせない設計を呼び込む。

**例外の作り方**: 外部と共有する published language（このリポジトリでは検証式の木 `Expression`）だけは、**パス・型名・使ってよい層**を明記した表に載せて免除する。表への追加は便宜ではなく裁定である。

**実例**: 免除表 `PUBLISHED_LANGUAGE` は **11 件**。domain 層に存在する公開 `interface` は `src/kernel/domain/expression.ts` の `Expression` **1 件だけ**で、`architecture.test.ts` がそれを固定している。

**検査**: `no-data-models-in-domain`、`published-language-layers`。

### D6 — フィールドにプリミティブを置かない

**規則**: domain のフィールドに `string` / `number`（およびその配列・`Set`・`Map`）を素で持たせない。ドメインプリミティブ（DP）に包む。

**例外は 2 つだけ**、いずれも名前で識別する。①**散文**——人間や LLM が読む自由文（`detail`・`reason`・`message`・`ears` など）。②**凍結トークン**——外部契約で byte が固定されている文字列（`state`・`from`・`to`・`attrPath`）。

**なぜ**: `string` は何でも入る型なので、取り違えを型で防げない。ただし全部を包むと、自由文まで無意味なラッパを被る。だから例外を**名前の表**として明示する。

**実例**: 免除セットは散文 19 名・凍結トークン 4 名。DP は `readonly #value` 単一フィールド＋`private constructor`＋`equals`＋`asString()` の定型（`src/kernel/domain/unit-name.ts` の `UnitName` ほか 15 件）。

**検査**: `no-primitive-fields-in-domain`。

### D7 — getter を作らない。境界が読む面はメソッドで、変換の語彙で名づける

**規則**: `get x()` 構文を使わない。I/O 境界（Repository・serializer・presenter）が読む必要のある面だけをメソッドとして公開し、変換の語彙で名づける——単数は `asString()` / `asNumber()`、コレクションは `toStrings()` / `toArray()`、文書化は `toDocument()`。

**なぜ**: プロパティに見える面は「取り出して外で判断する」を誘う。メソッドにして変換の名前を与えると、それが**境界のための面**だと読める。

**実例（実測）**: `src/` 全体で `get` アクセサは **0 件**。

**検査**: `no-get-accessors`。

### D8 — 判断は型の内側に置く

**規則**: 型が答えられる問いは、その型のメソッドとして書く。外で値を取り出して条件分岐しない。

**なぜ**: Tell-Don't-Ask。判断が散らばると、規則を変えるときに全部の呼び出し側を探すことになる。

**実例**: `AttrDecl.boundsInverted()` / `defaultBelowMin()`（宣言自身が自分の不整合を答える）、`Components.dependencyCycles()`、`ExpressionTree.usesPrime()`。

**このリポジトリでの逸脱**: `design/domain` に**外で分岐している箇所が 15 件**残っている（§8）。規則は規則として、達成度は 100% ではない。

**検査**: なし（レビュー）。

### D9 — コレクションはファーストクラスコレクションにする

**規則**: 配列や集合をフィールドに素で持たせず、それを隠す型を作る。正準順・一意化・検索はコレクション自身のメソッドにする。

**なぜ**: 「この配列はソート済みか」「重複はあるか」という問いに、コレクションが答えられるようになる。

**実例**: FCC は `#values: readonly T[]` ＋ `of` ＋ `Symbol.iterator` ＋ `toArray()` の定型（`design/domain` 48 件・`refcheck/domain` 25 件・`requirements/domain` 21 件）。キーで引く索引は `KeyedIndex<K, V>` / `KeySet<K>`（`src/kernel/domain/`）で包み、キーは DP に限る。

**検査**: `no-primitive-fields-in-domain`（部分的——プリミティブ配列は捕まる）。

### D10 — 変種は `#kind` と名前つきファクトリで表し、外へは fold で開く

**規則**: 「いくつかの姿のどれか」を表す値は、`#kind` フィールドと枝ごとの名前つきファクトリで作る。中身を getter で晒さず、**すべての枝の処理を受け取る 1 つのメソッド**（`match<T>(handlers)`）か、閉じた述語群で開く。ひとつの文脈の中では、どちらかに統一する。

**なぜ**: 枝が増えたとき、コンパイラが漏れを教えてくれる。getter で `kind` を晒すと、外の `if` が増えて漏れが見えなくなる。

**実例**: `refcheck/domain` の `*Outcome` 7 型は `match<T>`。`SkipReason` / `FindingKind` は名前つきファクトリ＋述語。

**このリポジトリでの逸脱**: 同じ「閉じた変種」に `match<T>`（refcheck）と述語群（requirements の `*Verdict`）が併存している（§8）。

**検査**: なし（レビュー）。

### D11 — 集約は境界と不変条件をコメントではなくコマンドで守る

**規則**: 集約ルートは、恒等（識別）・境界の内側に抱えるもの・守る不変条件を持つ。状態を変える操作は**集約自身のコマンド**として書き、そのコマンドの中で不変条件を再確立する。省略可能な部分は集約自身が抱える（Repository のメソッド変種で吸収しない）。

**なぜ**: 「保存の直前に整える」ようにすると、整える前の状態が外に漏れる。コマンドの中で守れば、集約はいつ見ても正しい。

**実例**: `src/design/domain/design-verify-directory.ts` の `DesignVerifyDirectory`——恒等は verify ディレクトリのパス、境界には backend ごとの report・候補・cross-check を抱え、不変条件は「backend ごとに report は 1 つ」「cross-check は不在か、いまの reports から導いたもの」。公開準備は `finalizedWith(candidate, model, schema)` が候補の適合とcross-check導出をまとめて行う。個別操作でも、`finalizing` と候補を変更する `conformedTo` は古いcross-checkを落とす。可変部は `DesignReport | null`（`Option` 型は使わない）。`src/requirements/domain/verification-directory.ts` に同型がある。

**検査**: なし（レビュー）。

### D12 — 検査手順だけを包んだ型を作らない

**規則**: 検査は、それを言える側——宣言・コレクション・集約——の不変条件やメソッドとして書く。検査手順を持つだけのドメインサービスは作らない。作る必要があると判断したら、実測を添えて人間の裁定にかける。

**なぜ**: 手順を包んだ型は、周りのオブジェクトを貧血にする。判断が外に出た時点で、オブジェクトは「データ」に退化する。

**実例**: `AttrDecl` が自分の境界の逆転を答え、`Components` が依存の循環と所有の衝突を答え、`DeclaredEntities` が参照の解決を答える。**「検査だけを包んだ型」を明示的にドメインサービスと名乗るものは 4 文脈とも 0 件。**

**このリポジトリでの逸脱**: 検査の重心が「手順」にある型が数件ある（`DesignUnitDecl.wellFormednessErrors` 199 行、`UnitRefinementPlan.of` 178 行）。さらに `src/design/domain/index.ts` のコメントは、統合された 36 シンボルを「ドメインサービス群」と自称している（§8）。

**検査**: なし（レビュー）。

---

## 3. 境界 — port と usecase（P）

### P1 — port は usecase 層に置く

**規則**: 出力ポート（Repository・Client・Clock などの interface）は `usecase/port/` に置く。domain 層には置かない。

**なぜ**: domain に port を置くと、ドメインオブジェクトの内側から Repository を呼ぶ道ができる。層で塞ぐ。

**実例**: `src/kernel/usecase/` は 3 ファイルで **import が 1 件も無い**——`RepositoryError` と `Clock` だけを持つ、依存ゼロの port 層。

**検査**: `ports-live-in-port-dir`。

### P2 — Repository の語彙は「取得」と「保存」だけ

**規則**: Repository の interface が持つメソッドは、集約を**取得する** `findById` / `findByDirectory` と、集約を**保存する** `store` だけ。引数は集約の識別子（または集約を特定するパス）、戻り値は**集約の全体**。部分更新のメソッド、条件つき保存の変種、DTO を受ける口を作らない。

**なぜ**: Repository は集約を出し入れする口であって、業務の語彙を持つ場所ではない。ここに語彙が増えるのは、たいてい**集約の設計が間違っている**という信号である。「保存のしかたが 2 通り要る」と思ったら、その差は集約自身が持つべき状態である。

**実例（実測）**: Repositoryのinterfaceは11個。`RefinementMaterialsRepository` は読取専用で `findById` のみ。他の10個は取得と `store` を持ち、`store` の引数は集約そのもの。

**失敗契約**: 全Repositoryの取得は `Result<集約, RepositoryError>` を返す。refinementの適用外（要件モデルの不在）と、存在する入力の不正・I/O失敗を混同しない。

**検査**: `ports-live-in-port-dir`（命名）、`commands-return-void`（`store` の戻り値）。

### P3 — 集約を持たない外部は Client と名づける

**規則**: 集約を所有せず、外の世界を読むだけ／叩くだけの口は `*Client` と名づけ、Repository の語彙を使わない。

**なぜ**: 名前で役割が分かる。Repository は「うちの集約」、Client は「よその世界」。

**実例**: `doctor` は Repository を **1 つも持たず**、`DoctorWorkspaceClient` / `SolverProbeClient` / `ReleaseTagsClient` などの Client だけを持つ——doctor はどの成果物も所有せず、読むだけだから。ソルバー実行も `Z3SolverClient` / `QuintClient`。

**検査**: `ports-live-in-port-dir`。

### P4 — コマンドは値を返さない

**規則**: 状態を変える port のメソッドは、成功時に値を返さない（`Result<void, E>`）。

**なぜ**: CQS。書き込みが値を返すと、呼び手はその値と保存されたものが同じだと思い込む。

**実例**: 全 Repository の `store` が `Result<void, RepositoryError>`。

**意図的な例外**: usecase の上に立つ collaborator は、書いた直後に**書いたものから導いた値**を返してよい。`DesignReportFinalizer.finalize` は保存と同時に判定を返す——「stdout に出す判定とファイルに書いた内容が食い違わない唯一の作り方」だから。例外を作るときは、この水準の理由をコメントに書く。

**検査**: `commands-return-void`。

### P5 — 失敗の語彙は共有し、port ごとに増やさない

**規則**: Repository の失敗は 1 つの共有型で表す。バリアントは**材料だけを運び、文言は表示側が持つ**。port ごとに固有のエラー型を作らない。

**なぜ**: エラー型が port の数だけ増えると、呼び手は同じ分岐を何度も書く。

**実例**: `RepositoryError`（`src/kernel/usecase/port/repository-error.ts`）は 3 バリアントだけ——`not-found`（不在）・`io-failed`（I/O の失敗）・`corrupt`（読めたが集約として再構成できない）。**4 文脈の全 Repository がこの 1 つを使い、固有エラー型は 0 件。**

**検査**: なし（レビュー）。

### P6 — interactor はクラス、依存はコンストラクタ注入、公開メソッドは 1 本

**規則**: ユースケースはクラスとして書き、port をコンストラクタで受け取り、公開メソッドは `execute` 1 本にする。

**なぜ**: 「このユースケースは何に依存しているか」がコンストラクタに全部並ぶ。公開メソッドを 1 本に絞ると、クラスが 2 つのことを始めた瞬間に気づく。

**実例**: `*UseCase` 18 個がすべて `execute` 1 本。複数の公開メソッドを持つのは、複数のユースケースが共有する application collaborator だけ（`DesignReportFinalizer` / `VerificationReportFinalizer` / `DesignVerificationAcquirer`）で、いずれも「ドメインオブジェクトではない」とコメントで明示されている。

**検査**: `ports-live-in-port-dir`（interactor を `port/` に置かせない）。

### P7 — usecase の戻り値は閉じた結果の型にする

**規則**: `execute` は `Result` ではなく、そのユースケースが**取りうる結末を全部並べた閉じた union**（`kind` 判別）を返す。成功も、適用外も、上流の失敗も、同じ union の枝にする。

**なぜ**: 呼び手（entry）は結末ごとに exit code と出力を決める。全部が 1 つの型に並んでいると、枝の取りこぼしをコンパイラが教えてくれる。

**実例**: `VerifyDesignOutcome` は `not-applicable` / `acquisition-failed` / `model-unreadable` / `version-mismatch` / `backend-unavailable` / `save-failed` / `verified` の 7 枝。

**検査**: なし（レビュー）。

### P8 — 表示のための投影は usecase に置く

**規則**: 照会・表示のためだけに組み立てる型（リードモデル）は domain に置かず、usecase の `read-model/` に置く。永続化のメソッドも port への依存も持たせない。

**なぜ**: 表示の都合はドメインの語彙ではない。domain に置くと、業務の意味を持たない型が domain を薄める。

**実例**: `src/doctor/usecase/read-model/` の 8 型（`CoverageAssessment` ほか）。他の 3 文脈は「検証してレポート集約を作り保存する」1 本道なので、リードモデルを持たない。

**検査**: なし（レビュー）。

### P9 — 環境の観測は port として注入する

**規則**: 現在時刻・プロセスの生存・乱数のような環境の観測は、直接呼ばずに port として注入する。

**なぜ**: これらを直接呼ぶと、その関数はテストで固定できない。`process.*` が entry 限定であることの帰結でもある。

**実例**: `Clock`（`now(): number`）は `src/kernel/usecase/port/clock.ts`。ロックの所有者が生きているかを見る `ProcessLiveness` は `src/kernel/adapter/process-liveness.ts` に置かれ、実装は entry が注入する。

**検査**: `process-only-in-entries`（間接的）。

---

## 4. 外界 — adapter と entry（A）

### A1 — 寛容な復元は adapter から入り、domain の内側へ連鎖する

**規則**: 書かれた文書を読んで domain の値にする経路（`reconstitute`）は adapter が起点になる。domain の型は、自分のフィールドを DP に包み直すために `reconstitute` を呼んでよい。**検証つきの `parse` を呼ぶのは、未検証の生値を初めて受け取る場所だけ。**

**なぜ**: 復元は「文書に書かれている姿を、そのまま型に載せる」操作である。途中で検証を挟むと、壊れた文書を「壊れている」と報告できなくなる。

**実例（実測）**: `.reconstitute(` の呼び出しは adapter 270・domain 201・usecase 11・entries 0。domain 側の呼び出しは、`private constructor` や `static reconstitute` の中で生の `string` を DP に包む形（`UnitName.reconstitute(props.unit)` など）。

**検査**: なし（レビュー）。

### A2 — 文書の形は domain が持ち、adapter は byte を描くだけ

**規則**: 出力文書のキー順・構造は、集約の `toDocument()` が決める。adapter はそれを受け取って文字列にするだけで、キー順を選ばない。

**なぜ**: キー順が凍結契約の一部なら、それはドメインの知識である。adapter に置くと、同じ契約を複数の adapter が別々に持つことになる。

**実例**: serializer は `` `${JSON.stringify(doc, null, 2)}\n` `` を書くだけ。契約への適合判定も domain 側（`FindingsSchema` 値オブジェクトと集約の `conformedTo`）にあり、Repository は schema を読まない。

**検査**: なし（レビュー）。

### A3 — 未信頼入力は adapter の境界で検査し、判断の材料として domain へ渡す

**規則**: 外から来る JSON / Markdown は adapter で構文と schema を検査する。検査に落ちたことを**例外にせず**、`Result` で返すか、**エラーの一覧を材料として集約に渡す**。合否そのものは domain / usecase が決める。

**なぜ**: 「壊れている」は、このプラグインでは報告すべき結果であって、処理の中断ではない。

**実例**: schema 検査の結果は `ErrorMessages` として集約に渡り、判定は集約が下す。JSON の parse 失敗・フェンス数の不一致は `err({kind: "corrupt", …})` として Repository の境界で返る。

**検査**: なし（レビュー）。

**補足（2026-09-05）**: 検証結果文書の欠落や型不一致を空のfindings／skippedへ補完してはならない。adapterの `decodeFindingsDocument` は復号できない形を失敗にし、未知の語彙は逐語で運ぶ。到達性の判定とrefinementの対象別結果の解釈はドメイン側が所有する。

### A4 — 書き込みは atomic に、読み書きは往復させる

**規則**: ファイル書き込みは一時ファイルへ書いてから rename する。集約は読んだ原文のバイト列を保持し、保存時にはそれを書き戻す（`findById ∘ store` が恒等）。

**なぜ**: 途中で落ちても壊れた文書を残さない。往復則があると、「読んで保存しただけ」で byte が変わらないことを保証できる——凍結契約のあるリポジトリでは、これが回帰の一次防衛線になる。

**実例**: `writeFileAtomically`（`src/kernel/adapter/atomic-write.ts`）に一本化。集約は `sourceDocument()` で原文を持ち、防御コピーを返す。

**検査**: なし（レビュー）。

### A5 — 例外は adapter の中の局所制御にだけ使う

**規則**: 例外を投げてよいのは adapter の中だけ。例外の型は **export せず**、**同じファイルの中で catch し**、ドメインの値（`Result` / 結果の union / skip の記録）に変換する。層の境界を越えて例外を飛ばさない。

**なぜ**: 深い再帰的な変換（式木から SMT-LIB への compile など）では、途中で失敗を上まで返すより投げるほうが素直に書ける。しかしそれを外に漏らすと、呼び手は何が飛んでくるか型から読めなくなる。局所に閉じれば両方取れる。

**実例（実測）**: `catch` の分布は adapter 92・entries 4・domain 0・usecase 0・infrastructure 0。`CompileError` / `SmtCompileError` / `YamlError` はいずれも export されないファイル内クラスで、同じファイルで捕まえて `{kind: "uncompilable"}` や `VerificationSkipped(reason: "compile-error")` に変換される。

**検査**: なし（レビュー）。

### A6 — 例外から失敗の語彙への写像は adapter の仕事

**規則**: Node の例外を `RepositoryError` の 3 バリアントに割り当てるのは adapter が担う。domain と usecase は割り当て済みの語彙だけを見る。

**実例**: 全 Repository 実装が同じ形——例外の `message` を `cause` に載せ、`not-found` / `corrupt` / `io-failed` のどれかに落とす。

**検査**: なし（レビュー）。

### A7 — 外部プロセスの設定と実装を分ける

**規則**: 外部プロセスや HTTP を叩く Client は、設定値だけを持つ `*-client-config.ts` と実装の `*-client-impl.ts` に分ける。

**なぜ**: タイムアウトや実行ファイルのパスをテストで差し替えられる。

**実例**: 8 組すべてがこの形——例外なし。

**検査**: なし（レビュー）。

---

## 5. 失敗の表現（F）

### F1 — 予期された失敗は値で返す

**規則**: 起こりうると分かっている失敗は `Result<T, E>` か閉じた結果 union で返す。例外を通常の制御に使わない。

**実例**: DP の `parse` は全部 `Result`。Repository は `Result<T, RepositoryError>`。usecase は結果 union。

**検査**: なし（レビュー）。

### F2 — `throw` は欠陥の検出にだけ使い、文言を `defect:` で始める

**規則**: domain と usecase で `throw` してよいのは、**型の不変条件が破れている＝プログラムの欠陥**を検出したときだけ。メッセージは `defect:` で始める。

**なぜ**: 「起こりえないはずの状態」を黙って通すとバグが遠くで顔を出す。かといってそれは業務上の失敗ではないので、`Result` の枝にすると呼び手全員が意味のない分岐を書くことになる。前置きを固定すると、grep 一発で「これは欠陥検出だ」と分かる。

**実例（実測）**: domain 7 件・usecase 2 件、**全部 `defect:` 始まり**。例: 「`kind` が `extracted` なのにペイロードが `null`」という到達不能ケースの番人。

**検査**: なし（レビュー）。ただし `grep -rn 'throw new' src | grep -v defect:` で機械的に見つけられる（adapter の局所例外は A5 の対象）。

### F3 — 網羅性はコンパイラに証明させる

**規則**: 閉じた union を扱い切ったことは `unreachable(x: never)` で表明する。枝が増えたら型検査が落ちる。

**実例**: `src/kernel/infrastructure/result.ts` の `unreachable`。

**検査**: なし（型検査が担う）。

### F4 — 失敗の型を二段に分ける

**規則**: 失敗を表す型は、**業務の失敗**と**生成の門の失敗**で形を変える。

**(a) ドメインエラー — 業務の言葉で名づけた失敗**。ユビキタス言語の一員なので、公開するクラスとして書く。`#kind` に閉じたバリアントを持ち、バリアントごとに名前つきファクトリを置き、**その失敗が外にどう見えるか**（凍結文言、公開語彙への対応）を自分で知る。`Result` の値として運ぶ。

**(b) 生成の門の失敗 — `parse` が返すもの**。`type XxxError = { readonly kind: "…"; readonly raw: … }` の判別 union として、そのファイルの中に置き、**export しない**。`parse` が返す `Result` の型引数として現れるだけで、外の誰も名前で参照しない。

**なぜ**: この 2 つを同じ形にすると、どちらかが割を食う。業務の失敗を匿名の `type` にすると、文言や公開語彙への対応の置き場が無くなって呼び手に散る。逆に「空文字だった」程度の失敗までクラスにすると、名前だけの型が増える。

**実例**: (a) `src/design/domain/refinement-map-defect.ts` の `RefinementMapDefect`——4 バリアント、名前つきファクトリ 4 つ、凍結文言と skip 理由 `compile-error` への対応を型自身が持つ。`index.ts` から公開されている。(b) domain 層に **46 件**の局所 `type`（`ObligationIdError`・`TokenError` など）。いずれも export されない。

**このリポジトリでの逸脱**: (b) の名前が重複している——`TokenError`（`kind: "empty-token"`）が refcheck の 12 ファイルで別々に定義され、うち `BusinessRuleId.parse` は実際には形式検査なのに `empty-token` を返す（§8）。

**検査**: なし（レビュー）。

---

## 6. 名前とファイル（N）

### N1 — 1 ファイル 1 公開型、ファイル名は型名の kebab-case

**規則**: 1 つのファイルが公開する**型**（`class` / `interface` / `enum` / `type`）は 1 つだけ。ファイル名はその型名の kebab-case と一致させる。関数と定数の数は数えない（対になる読み書き関数が同居するのは構わない）。

**なぜ**: 「この型はどこか」を検索なしで引ける。ファイルを開く前に何が入っているか分かる。

**実例**: `unit-name.ts` → `UnitName`、`keyed-index.ts` → `KeyedIndex`。コレクションは複数形どうしで対応（`finding.ts` / `findings.ts`）。

**検査**: `one-public-type-per-file`。

### N2 — `index.ts` は再輸出だけ

**規則**: `index.ts` には宣言を書かない。明示列挙の再輸出だけを置く。

**検査**: `one-public-type-per-file`（`index.ts` が宣言を持てば違反）、`no-export-star`。

### N3 — production のファイルに行数の上限を置く

**規則**: `src/` のファイルは 1,000 行未満とする。

**なぜ**: 上限そのものより、「超えそうだ」と気づく機会に意味がある。

**実例**: 実際の最大は 400 行（`src/design/adapter/refinement-query-plan.ts`）。

**検査**: `architecture.test.ts` の `MAX_PRODUCTION_FILE_LINES`。

### N4 — 言語機能の禁止をいくつか置く

**規則**: `enum` を使わない（閉集合は D10 の形で表す）。非 null 表明（`!`）を使わない。`export *` を使わない。テストの成果物を `src/` に置かない。npm の依存は許可リストで管理する。

**実例（実測）**: `enum` 宣言 0 件・`export *` 宣言 0 件。許可された npm パッケージは `z3-solver` の 1 つだけ。

**検査**: `no-enums`、`no-non-null-assertions`、`no-export-star`、`no-test-payloads`、`only-sanctioned-imports`。

### N5 — 語彙を決めて、同じ語を同じ意味で使う

**規則**: 型名に繰り返し現れる語は意味を固定する。新しい語を増やす前に、既存の語で言えないかを見る。

**実例（このリポジトリの語彙）**:

| 語 | 意味 |
|---|---|
| `*Decl` | 文書に**書かれた宣言**。検査の材料であって正規化済みモデルではない |
| `*Outcome` | 文書の**解析結果**を表す閉じた union（absent / unparseable / extracted …） |
| `*Verdict` | バックエンド実行 1 回分の**判定** |
| `*Plan` | コンパイラの**対応表**（形式テキストそのものは含まない） |
| `*Report` | 出力契約に適合する**文書**の集約 |
| `*Sketch` | 他の文書から読み取った**不完全な像** |
| `*Anchor` | 内容ハッシュによる**同一性の錨** |
| `*Materials` | 検査の**材料**（判定そのものではない） |
| `*Id` | 集約・エンティティの**識別子** |

**このリポジトリでの逸脱**: `Ref` と `Reference`、`compareTo` と `compareBy*` が混在している（§8）。

**検査**: なし（レビュー）。

---

## 7. 新しい型を作るときの決定手続き

上から順に当てはめ、最初に当たったところで止める。

1. **外の世界を叩く口か？** → port（`usecase/port/`）。うちの集約を出し入れするなら `*Repository`（`find*` と `store` だけ／P2）、よその世界を読む・叩くだけなら `*Client`（P3）。
2. **ユースケースそのものか？** → `*UseCase`（クラス、コンストラクタ注入、`execute` 1 本／P6）。複数のユースケースが共有する手続きなら application collaborator にして、「ドメインオブジェクトではない」と明記する。
3. **表示・照会のためだけの形か？** → リードモデル（`usecase/read-model/`／P8）。
4. **外部形式の知識（SMT-LIB、YAML、HTTP の形）か？** → adapter。例外を使うなら export せずそのファイルで捕まえる（A5）。
5. **Repository が出し入れする単位か？** → 集約ルート。恒等・境界・不変条件を決め、状態変更はコマンドにする（D11）。可変部は集約自身が抱える。
6. **コレクションから鍵で引かれるか？** → エンティティ（識別子を持つ）。
7. **配列や集合を隠したいか？** → ファーストクラスコレクション（D9）。
8. **スカラー 1 個か？** → ドメインプリミティブ。`of` / `parse` / `reconstitute` の門を決める（D4）。
9. **「いくつかの姿のどれか」か？** → `#kind` ＋ 名前つきファクトリ ＋ `match<T>` か述語（D10）。
10. **ドメインで起きた出来事の不変の記録か？** → ドメインイベント。
11. **ここまでで当たらない** → **作る前に人間の裁定にかける。** 実測した問題と、なぜ既存の 4 種で表せないかを添える。「手順を包んだ型」に見えるなら、まずその判断を言える側（宣言・コレクション・集約）に移せないかを試す（D12）。

---

## 8. このリポジトリに残っている逸脱

規則を守れていない箇所を、既知のものとして記録する。**規則の側を曲げて辻褄を合わせない**ため、また移植先が「これは真似しなくてよい」と分かるために書く。

### 意図的な例外（コード上に理由が書かれている）

| 箇所 | 内容 | 理由 |
|---|---|---|
| `src/kernel/domain/expression.ts` の `Expression` | domain 層で唯一のプロパティ付き公開 `interface` | 外部と共有する published language そのもの。免除表に 1 件として載る |
| `src/kernel/domain/content-hash.ts` | domain から `node:crypto` を直接 import | 副作用のない計算。`no-io-in-pure-layers` が domain に対してだけ `node:crypto` を許可している |
| `src/refcheck/domain/reference-check-report.ts` の `ReferenceCheckReport` | 全 4 文脈で**唯一の可変集約**（`void` を返すコマンド 3 つ） | 「無沈黙台帳」——`checked = 全 family − failed − skipped` を各コマンドの後で再確立する設計。15 個の検査メソッドがこの可変性に依存する |
| `DesignReportFinalizer.finalize` / `VerificationReportFinalizer.finalize` | 書き込みつつ値を返す（P4 の例外） | stdout の判定とファイルの内容を食い違わせない唯一の作り方 |
| `src/design/adapter/` と `src/requirements/adapter/` の compiler 群 | adapter に 300〜400 行のコンパイラが同居 | SMT-LIB / Quint という外部形式の知識をここに封じ、domain には判定に要る事実だけを返す |
| 式コンパイラの重複（`smtOfExpr` と `smtOf`） | ほぼ同一のロジックが 2 箇所 | 参照の解決表と文言が文脈ごとに凍結されているため、意図的に統一しない |

### 揃っていないだけの箇所（根拠が見当たらない）

| 箇所 | 内容 |
|---|---|
| `design/domain` の 15 箇所 | domain の中で値を取り出して外で分岐している（D8 の未達） |
| `src/design/domain/index.ts` のコメント | 統合された 36 シンボルを「ドメインサービス群」と自称。実体は集約・値オブジェクト・FCC だが、`UnitRefinementPlan.of`（178 行）や `DesignUnitDecl.wellFormednessErrors`（199 行）は手続きに重心がある（D12 の未達） |
| `refcheck/domain` の 7 型 | `#seed` にフィールドを一括で持つ書き方が、同じ層のフィールド分解型と混在。同じ型リテラルを 3 回書き写している |
| `doctor/domain` の `PluginVersion.parse` | 全 48 個の `parse` で唯一 `Result` を返さない（`PluginVersion \| null`）。doctor/domain は `kernel-infrastructure` を 1 件も import しない |
| `refcheck/domain` の `*Outcome` 5 型 | 同じ「到達不能な枝」の扱いが、3 型は `throw`、2 型は黙って別の枝へ落ちる、と割れている |
| `VerificationSkipped` / `Skipped` の `reason` | kernel に `SkipReason` DP（閉集合 9 値）があるのに、両方とも生の `string` で運ぶ（D6 の未達） |
| `SiblingUnitIndex` | 索引で唯一 `KeyedIndex` を使わず生の `ReadonlyMap` の入れ子を持つ |
| `refcheck/domain/functional-design.ts` | コメントだけの孤児ファイル（export 0、どこからも import されない） |
| 閉じた union の公開面 | `match<T>`（refcheck）と述語群（requirements の `*Verdict`）に割れている（D10 の未達） |
| `HealthVerdict.document()` | `toDocument()` でない唯一の変換 |
| `Ref` と `Reference`、`compareTo` と `compareBy*` | 語彙が揺れている（N5 の未達） |
| `design/domain` の 17 行 | 同じパッケージのファイルを bare specifier（`@deep-spec/design-domain`）で引いている。同一パッケージ内は相対 import という L7 の未達で、統合された refinement 系のファイルに集中している。1 ファイル（`design-event-catalog.ts`）では相対と bare が混在 |
| `bunfig.toml` のカバレッジ設定 | コメントは「domain 層のみ」と言うが、除外リストに `kernel/usecase` と `kernel/infrastructure` が無く、実際は床の対象に入っている |

### ドメインイベントについて

**4 文脈すべてでドメインイベントは 0 件。** D1 は種別として挙げているが、このリポジトリには実例が無い。「イベント」を名乗る型はあるが、いずれも状態機械の遷移や写像の宣言であって、出来事の記録ではない。発行・購読の機構も無い。移植先でイベントが要るなら、この規則群は形を示していない。

---

## 9. 他のプラグインへ移すとき

### そのまま移せるもの

`L1`〜`L7`（構造）、`D2`〜`D4`、`D7`、`D9`〜`D12`、`P1`〜`P9`、`A5`〜`A7`、`F1`〜`F4`、`N1`〜`N4`。

これらは領域に依存しない。特に **`P2`（Repository の語彙を閉じる）と `D4`（生成の門を三つに分ける）** は、小さなプラグインでも最初から効く。

### 領域を見て決めるもの

| 規則 | 効く条件 |
|---|---|
| `D5` / `D6`（データモデル禁止・プリミティブ禁止） | 型の取り違えが実際に起きる規模か。小さなプラグインでは DP のラッパが重荷になることがある。導入するなら、散文と凍結トークンの免除を**最初から名前の表で**持つ |
| `A1`〜`A4`（復元・文書・原文保持） | 出力が byte で凍結されているか。凍結契約が無いなら、原文の往復則は要らない |
| `D11`（集約とコマンド） | 保存の単位が複数のファイル・複数の要素にまたがるか。単一ファイルの読み書きだけなら過剰 |
| `N3`（行数上限） | 好みでよい。ただし数値を決めて機械で見ること |

### 移すときの手順

1. **この文書と [`enforcement.ja.md`](enforcement.ja.md) をコピーする。** §8 の逸脱の表は自分のリポジトリのものに書き換える（空でよい。埋まっていくのが正常）。
2. **層を決めて `package.json` を置く。** `bunfig.toml` に `[install] linker = "isolated"` を入れる。これが無いと `L2` が効かない。
3. **機械検査を入れる。** `tests/architecture/rules.ts` をコピーして、`CONTEXTS` / `LAYERS` / `ENTRY_FILES` / 免除表を自分のものに差し替える。20 規則を一度に入れる必要はない——`L2` / `L3`（層の向き）、`D2` / `D3`（フィールドとコンストラクタ）、`N1`（1 ファイル 1 公開型）から始めると、後から足す規則が守りやすくなる。
4. **red/green example を必ず書く。** 「違反を検出できること」をテストで証明する。検出できない検査は、緑でも何も守っていない。
5. **免除は表にする。** 名前ベースの除外や「このファイルは特別」という暗黙の扱いを作らない。表に載せるのは裁定であって、便宜ではない。

### 移さないほうがよいもの

- **`SANCTIONED_CROSS_CONTEXT` の中身**（このリポジトリでは `design/domain → requirements/domain` の 1 本）。表の仕組みは移し、中身は自分の文脈で決める。
- **`PUBLISHED_LANGUAGE` の 11 件**。同じく仕組みだけ移す。
- **§8 の逸脱**。真似しない。

---

## 参照

- [`enforcement.ja.md`](enforcement.ja.md) — 機械検査 20 件の棚卸しと、規則との対応表
- [`../decisions.ja.md`](../decisions.ja.md) — 個々の裁定がいつ・なぜ下されたかの経緯（この文書は「いまの規則」、あちらは「経緯」）
