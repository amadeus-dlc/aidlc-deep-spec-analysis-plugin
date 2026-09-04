# 機械検査の棚卸し

日本語 | [English](enforcement.md)

[`design-rules.ja.md`](design-rules.ja.md) の各規則が、機械で守られているのか、人が読んで守っているのかを対応づける。

検査の実体は `tests/architecture/rules.ts`（879 行）と `tests/architecture.test.ts`（520 行）にある。`bun test tests/architecture.test.ts` は現在 **38 pass / 0 fail**。

## 数え方

- **19 規則** が `ALL_RULES` に入り、`src/` 配下の全 `.ts` に適用される。
- **1 規則**（`manifest-dependency-direction`）は別経路で、16 個の層 `package.json` に適用される。
- 合計 **20 規則**。**全規則が red example と green example を持つ**——「違反を検出できること」自体をテストで証明している。検出できない検査は緑でも何も守らないので、これは規則本体と同じくらい重要である。

判定の基盤は `locationOf` で、相対パスを `entry` / `data` / `{文脈, 層}` / 未分類 の 4 種に分ける。`architecture.test.ts` は**未分類が 0 件**であることも固定している。

字句解析は自前の軽量トークナイザ（`stripComments` / `stripStrings`）で、文字列やコメントの中の `//` を誤検出しない。既知の限界として、正規表現リテラルの中の `//` は扱えない。

---

## 1. 規則 → 機械検査の対応

### 構造（L）

| 規則 | 機械検査 | 何を違反とするか |
|---|---|---|
| L1 文脈 × 層で切る | `one-public-type-per-file` ＋ `locationOf` 未分類ゼロの表明 | 分類できない場所にファイルがある |
| L2 層はパッケージ、依存は宣言 | **`manifest-dependency-direction`** | `package.json` の `name` が `@deep-spec/<文脈>-<層>` でない／`dependencies` のバージョンが `"workspace:*"` でない／自己宣言／許可外の辺を宣言 |
| L3 依存は内向きだけ | **`layer-direction`** | import 先の層が許可表 `ALLOWED_LAYER_TARGETS` に無く、横断許可表 `SANCTIONED_CROSS_CONTEXT` にも該当しない |
| L4 kernel/infrastructure は依存ゼロ | **`no-io-in-pure-layers`**（一部） | `infrastructure` が `node:*` を import する |
| L5 I/O は adapter と entry だけ | **`no-io-in-pure-layers`** ＋ **`process-only-in-entries`** | `domain` が `node:crypto` 以外の `node:*` を import／`usecase` が `node:fs`・`node:child_process`・`node:os` を import／層のファイルが `process.` か `import.meta` を参照 |
| L6 合成ルートは entry だけ | **`no-entry-imports`** ＋ `process-only-in-entries` | 相対 import の解決先が 10 本の entry のいずれかに一致する |
| L7 公開面は facade の明示列挙 | **`no-export-star`** ＋ **`no-cross-package-relative-imports`** | `export *` 宣言がある／相対 import が自パッケージの外に出る |

### ドメイン層（D）

| 規則 | 機械検査 | 何を違反とするか |
|---|---|---|
| D1 住人は 4 種＋ドメインエラー | **なし（レビュー）** | 種別そのものは判定できない。D5 が最も近い代替 |
| D2 フィールドは `#private` だけ | **`domain-fields-are-private`** | domain の `export class` の本体直下（波括弧深さ 1）に `#` で始まらないフィールド宣言がある |
| D3 コンストラクタは private | **`private-constructor-in-domain`** | domain の `export class` の本体に `private constructor` が無い（`Error` を継承するクラスは除外） |
| D4 生成の門は三つ | **なし（レビュー）** | 名前と役割の対応は機械では判定できない |
| D5 データモデルを置かない | **`no-data-models-in-domain`** ＋ **`published-language-layers`** | domain の公開 `interface` がプロパティを持つ／公開 `type` の右辺がオブジェクト形か判別共用体形。免除は `PUBLISHED_LANGUAGE` の 11 件（パス＋型名の組）だけ |
| D6 プリミティブを持たない | **`no-primitive-fields-in-domain`** | domain のクラスの `#` フィールドや公開型のプロパティが `string` / `number`（とその配列・`Set`・`Map`）である。免除は散文 19 名・凍結トークン 4 名・`PUBLISHED_LANGUAGE` のファイル・「`#value` 単一フィールド」の構造的免除 |
| D7 getter を作らない | **`no-get-accessors`** | `get 識別子(` の宣言がある（全ファイル対象） |
| D8 判断は型の内側 | **なし（レビュー）** | — |
| D9 コレクションは FCC | **`no-primitive-fields-in-domain`**（部分） | プリミティブの配列は捕まるが、ドメイン型の生配列は捕まらない |
| D10 変種は `#kind` ＋ fold | **なし（レビュー）** | — |
| D11 集約はコマンドで守る | **なし（レビュー）** | — |
| D12 検査だけの型を作らない | **なし（レビュー）** | — |

### 境界（P）

| 規則 | 機械検査 | 何を違反とするか |
|---|---|---|
| P1 port は usecase に置く | **`ports-live-in-port-dir`** | `usecase/port/` で `export class` を宣言している（interactor を port に置いた）／`usecase/port/` の外で `Repository` か `Client` で終わる `export interface` を宣言している |
| P2 Repository の語彙を閉じる | **`commands-return-void`**（部分） ＋ `ports-live-in-port-dir`（命名） | `store` の戻り値が `Result<void, …>` でない。**メソッド名を `find*` と `store` に限る検査は無い**（レビュー） |
| P3 Client と名づける | `ports-live-in-port-dir`（命名の一部） | — |
| P4 コマンドは値を返さない | **`commands-return-void`** | `/usecase/port/` を含むパスで `store(...)` の戻り値が `Result<void, …>` 以外。**`store` という名前のメソッドしか見ない** |
| P5 失敗の語彙を共有する | **なし（レビュー）** | — |
| P6 interactor は `execute` 1 本 | `ports-live-in-port-dir`（配置のみ） | 公開メソッド数の検査は無い |
| P7 戻り値は閉じた union | **なし（レビュー）** | — |
| P8 リードモデルは usecase | **なし（レビュー）** | — |
| P9 環境観測は port で注入 | `process-only-in-entries`（間接） | — |

### 外界（A）・失敗（F）

| 規則 | 機械検査 | 備考 |
|---|---|---|
| A1〜A4、A6、A7 | **なし（レビュー）** | — |
| A5 例外は adapter に閉じる | **なし（レビュー）** | `grep -rn 'throw new' src \| grep -v defect:` で一覧は取れる |
| F1 予期された失敗は値で返す | **なし（レビュー）** | — |
| F2 `throw` は `defect:` だけ | **なし（レビュー）** | 同上の grep で機械的に確認できる |
| F3 網羅性は `unreachable` | **型検査が担う** | `tsc --noEmit` |
| F4 エラー型は公開しない | **なし（レビュー）** | — |

### 名前とファイル（N）

| 規則 | 機械検査 | 何を違反とするか |
|---|---|---|
| N1 1 ファイル 1 公開型 | **`one-public-type-per-file`** | 公開**型**（`class`/`interface`/`enum`/`type`）が 2 つ以上ある／1 つのときファイル名が型名の kebab-case と一致しない／`index.ts` が再輸出以外の宣言を持つ／entry・data が公開型を宣言している。**関数と定数は数えない** |
| N2 `index.ts` は再輸出だけ | `one-public-type-per-file` ＋ `no-export-star` | 同上 |
| N3 行数の上限 | **`MAX_PRODUCTION_FILE_LINES`**（`architecture.test.ts`） | `src/` のファイルが 1,000 行以上 |
| N4 言語機能の禁止 | **`no-enums`** / **`no-non-null-assertions`** / **`no-export-star`** / **`no-test-payloads`** / **`only-sanctioned-imports`** | `enum` 宣言／`!` の非 null 表明／`export *`／`src/` にテスト成果物／許可外の npm import（許可は `z3-solver` だけ）と、文字列リテラルでない動的 `import()` |
| N5 語彙を固定する | **なし（レビュー）** | — |

---

## 2. 層の境界は三重に効いている

`L2` / `L3` は 1 つの検査ではなく、3 つの独立した経路で守られている。ここが他の規則と違う。

| 経路 | 仕組み | 未宣言の層を import すると |
|---|---|---|
| **宣言** | `src/<文脈>/<層>/package.json` の `dependencies` に `"workspace:*"` で列挙 | `manifest-dependency-direction` が落ちる |
| **実行時** | `bunfig.toml` の `[install] linker = "isolated"` により、各パッケージ直下の `node_modules` には宣言した層だけがリンクされる | `Cannot find module '@deep-spec/…'` で非ゼロ終了 |
| **型検査** | 同じ `node_modules` を tsc が見る | `TS2307`（モジュールが見つからない） |

`tests/package-boundaries.test.ts` が、この 3 経路の挙動を**実測で固定**している——一時ディレクトリに実際のパッケージへのシンボリックリンクだけを張った fixture を組み、宣言済み／未宣言／深いパスの 3 通りを実行と型検査の両方にかける。

各層の `package.json` は `exports` を `{ ".": "./index.ts" }` だけにしているので、facade を通らない深いパスの import も同じく解決に失敗する（`L7` の実行時の裏づけ）。

**移植するときの注意**: `linker = "isolated"` が無いと、未宣言の層がルートの `node_modules` から解決されてしまい、`L2` も `L3` も実行時には無効になる（検査は残るが、コードは動いてしまう）。

---

## 3. 免除の表

免除を「暗黙の例外」ではなく**表**にしているのが、この検査群の要点である。表に載せるのは裁定であって便宜ではない。

| 表 | 件数 | 内容 | 使う規則 |
|---|---|---|---|
| `PUBLISHED_LANGUAGE` | **11** | パス・公開する名前・domain オブジェクトでない理由・使ってよい層 | D5、D6 |
| `SANCTIONED_CROSS_CONTEXT` | **1** | 文脈をまたぐ許可辺（`design/domain → requirements/domain`） | L3 |
| `ALLOWED_LAYER_TARGETS` | 4 | 層ごとの許可先 | L3 |
| `PROSE_FIELD_NAMES` | **19** | 自由文のフィールド名（`detail`・`reason`・`message`・`ears` など） | D6 |
| `STATE_TOKEN_FIELD_NAMES` | **4** | 凍結トークンのフィールド名（`state`・`from`・`to`・`attrPath`） | D6 |
| `ALLOWED_NPM` | **1** | 許可する npm パッケージ（`z3-solver`） | N4 |
| `ENTRY_FILES` | **10** | 合成ルートのファイル | L6、N1 |

`architecture.test.ts` は表の**件数そのもの**も固定している（`PUBLISHED_LANGUAGE` 11、`ENTRY_FILES` 10、層 manifest 16）。表が黙って増えることはない。

さらに `PUBLISHED_LANGUAGE` の各行については、対象ファイルが実在すること・その層が `domain` であること・理由と許可層が空でないこと・**そのファイルが実際にその名前の型を宣言していること**まで相互検証する。表と実体がずれない。

---

## 4. 隣接する機械検査（設計規則ではないが同じ性格のもの）

| テスト | 固定しているもの |
|---|---|
| `tests/package-boundaries.test.ts` | 上記 §2 の 3 経路 |
| `tests/build-tools.test.ts` | 生成物 `tools/` の drift guard（再生成して byte 比較）、生成の決定論（2 回生成して byte 同一）、出荷形の固定数（バンドル 10 本＋`data/` 4 本＝14 ファイル）、バンドルサイズ上限 512 KiB、`.js` を置かない拡張子規律 |
| `tests/coverage-gate.test.ts` | CI のカバレッジゲート（絶対 90%、base に対する相対、許容誤差 0.01） |
| `tests/kind-rank.test.ts` | ドメイン型の出力契約（`FindingKind` の正準順 11 種）の凍結 |

`tests/` の他のテストは golden 比較・ドメイン単体・永続化契約・ソルバー整合性で、設計規律の検査ではない。**命名・行数・公開型数を見る検査は `architecture.test.ts` にしか無い。**

---

## 5. カバレッジ床

`bunfig.toml`:

- `coverageThreshold = 0.9`
- 除外: `tests/**`、`scripts/**`、entry のセンサーと doctor、`src/entries/data/**`、そして **5 文脈の `adapter` 全部**と **4 文脈の `usecase`**。
- したがって床の対象は各文脈の `domain` 層と、`kernel/usecase`・`kernel/infrastructure`。

**既知の食い違い**: ファイル冒頭のコメントは「計測対象は domain 層のみ」と述べているが、除外リストに `kernel/usecase` と `kernel/infrastructure` が入っていないため、実際にはこの 2 つも床の対象になっている。どちらも純粋な型と関数なので実害は出ていないが、コメントと設定は一致していない。

---

## 6. 検査の既知の限界

`rules.ts` のコメントに明記されているもの、および読み取れるもの。**知らずに信頼しないために書く。**

| 検査 | 限界 |
|---|---|
| `commands-return-void` | `store` という**名前**のメソッドしか見ない。他の名前の書き込みメソッドは検査されない |
| `no-primitive-fields-in-domain` | 非公開の `type` 別名と index signature 型（`{ [k: string]: … }`）を見ない（コメントで「意図的に見ない」と明記） |
| `private-constructor-in-domain` | クラス本体の切り出しが次の `export` までの単純な検索で、波括弧の対応を追っていない |
| `stripComments` / `stripStrings` | 正規表現リテラルの中の `//` に対応しない。該当するソースがあれば、以降の行がコメント扱いされて検査を素通りしうる |
| 全般 | AST ではなく字句走査。TypeScript の構文を完全には理解しない |

これらは「検査があるから安心」ではなく「検査はここまでを見る」と読むためのものである。限界の外は §1 の「なし（レビュー）」と同じ扱いになる。

---

## 7. 新しい規則を足すとき

1. **判定可能な述語として書く。** 「きれいに書く」は検査にならない。
2. **red example を先に書く。** 違反するコードを書いて、検査が落ちることを確かめる。落ちない検査は緑でも何も守らない。
3. **green example も書く。** 正しいコードで落ちないことを確かめる。偽陽性は規則を無視させる。
4. **免除が要るなら表にする。** ファイル名の暗黙の除外や、名前の部分一致による例外を作らない。
5. **既存の判定を外さない。** 新しい条件を足すときは、古い条件を残したまま並べる。二重に検出されるのは構わない。
6. **`architecture.test.ts` に件数の表明を足す。** 免除表を作ったら、その件数も固定する。黙って増えないようにするため。

---

## 参照

- [`design-rules.ja.md`](design-rules.ja.md) — 規則の本体
- `tests/architecture/rules.ts` — 検査の実装
- `tests/architecture.test.ts` — red/green example と件数の表明
