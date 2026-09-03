# ドメインモデリングの型（Tell-Don't-Ask 全数反転で確立したもの）

issue #71「MECE フェンス」プログラム（波 1〜40、PR #72〜#119）と、その後の裁定キュー（#120〜#124）で確立した設計の型。規則の本文は `memory/project.md` の `## Mandated`、裁定の経緯は `docs/decisions.ja.md`。ここでは「どう作るか」と「どこで転ぶか」を書く。

## 1. 置いてよいドメインオブジェクトは 4 種だけ

domain 層に置くのは、エンティティ（ローカル／集約ルート）・値オブジェクト・ファーストクラスコレクション・ドメインイベントの 4 種。ドメインサービスは人間の裁定が必須。それ以外の種類（facts／materials／context／ledger／plan 型、随伴 static class、自由関数、例外型、generic record）を置きたくなったら、**実測ありの問題と対策を添えて裁定にかけ、裁定の後にだけ実装する**。

基線監査（2026-09-02）で 22 件の逸脱を洗い出し、全件を裁定した結果の対応表:

| 逸脱の型 | 裁定の型 | 例 |
|---|---|---|
| static のみの随伴 class | 解体して値オブジェクト／DP の振る舞いへ | `IdOrder` → DP の `compareTo` とコレクションの `sortedCanonically`；`Names` → DP `NormalizedName`；`Expressions` → 値オブジェクト `ExpressionTree` |
| 検査手順を包んだ自由関数／`*Materials` | 解体して宣言側の不変条件へ。集約が検査コマンドを持つ | `designWellFormednessErrors` → 各 `Design*Decl` の `wellFormednessErrors`；`*CheckMaterials` 786 行 → `Components.check` 等 |
| 可変累積器（`*Ledger`） | 集約ルートへ吸収。書き込みはコマンド、導出は不変条件 | `CheckFamilyLedger` → `ReferenceCheckReport.open / finding / skip / input` |
| 例外型 | UL で名づけた抽象データ型を `Result` の値で返す | `AlphaError` → `RefinementMapDefect`（4 バリアント、凍結文言は各バリアントが描画） |
| 分類文字列の型別名 | 値オブジェクトの内部表現に閉じる（外は `isKind` 等）か、DP にする | `LoweringKind` は内側へ；`CheckSeverity`／`CoverageState`／`FindingKind` は DP |
| generic record | 集約の内側へ解散 | `LoadedDocument<Outcome>` → `DesignRecord` が文書と検査を持つ |
| 「事実」を名乗る対応表 | 値オブジェクトと分類し `*Plan` に改名 | `SmtPlanFacts` → `SmtVerificationPlan` |
| 表示・照会のための投影 | リードモデルとして usecase（クエリ側）へ | doctor の `CoverageAssessment` 等 → `doctor/usecase/read-model/` |

## 2. commandable class の形

```ts
export class Obligation {
  readonly #id: ObligationId;          // フィールドは必ず #（TS private / readonly / static も違反）
  readonly #ears: string;              // prose（LLM が読む原文）は string のままでよい

  private constructor(props: { id: ObligationId; ears: string }) { ... }

  // 門は 2 つだけ。生文字列からは reconstitute、DP からは of
  static reconstitute(props: { id: string; ears: string }): Obligation { ... }
  static of(props: { id: ObligationId; ears: string }): Obligation { ... }

  // 判断は型の内側で。外で getter の値を見て分岐しない
  isViolatedIn(state: TraceState): boolean { ... }
  compareTo(other: Obligation): number { ... }

  // I/O 境界（Repository / serializer / presenter）が読むものだけ公開
  id(): ObligationId { return this.#id; }
  toDocument(): { id: string; ears: string } { ... }
}
```

- **getter の基準**: 残してよいのは I/O 境界が永続化・描画のために読むものだけ。domain 側のロジックが getter で中身を引き出して外で判断するのは禁止で、その判断はオブジェクトの振る舞いにする。読み手が I/O にも domain にもいない getter は消す。エンティティの `id()` は識別として残す。
- **Seed 型は作らない**: 門の引数は匿名インライン署名。外から型が要るときは `Parameters<typeof X.of>[0]`。
- **読み手が 1 つの型は解散する**: `Interpreted*Verdicts` や `*Composition` のような「読み手が 1 つの record」は読み手の署名へ溶かす。

## 3. ドメインプリミティブ（DP）とコレクション

- スカラーは DP にする（`ObligationId`・`TargetId`・`UnitName`・`AttributePath`・`ContentHash`・`QueryLabel`・`FenceCount` ……）。`of`（検証つき）／`reconstitute`（逐語）／`asString`／`equals`／`compareTo` を持つ。
- 単一契約の語彙は kernel で共有する（`FindingKind` は閉集合 11 種と順位、`VerificationMethod` 4 種、`AttributeKind` は `isBool/isInt/isEnum`）。順位表は 1 つに。
- コレクションは `readonly string[]` ではなく要素 DP の配列か FCC（`FrRefs`・`BrRefs`・`CheckedUnits`）。正準順はコレクション自身の `sortedCanonically()`／`sortedUnique()`。
- string キーの Map／Set は kernel の表現プリミティブ **`KeyedIndex<K extends { asString() }, V>` と `KeySet<K>` の 2 ファイルだけ**に置く。domain の索引はそれで包み、キーは DP、値は DP かドメインオブジェクト。
- 境界で剥く: JSON へ出すときは `toStrings()`／`toDocument()`、入るときは `reconstitute`。式ツリーなど published language の JSON 値は境界で包み、直列化で剥く。

## 4. 検査は宣言の不変条件、集約が文書と検査を持つ

- 「検査手順をオブジェクトに包んだだけのドメインサービス」は作らない。DD／CD／FD の各ファミリーの判定は、それを言える宣言側（`Components`・`Component`・`ContractRow`×`UnitDecls`・`SpecBlockAssessment`・`DeclaredEntities`・`RuleDecls`・`StateMachineSketch`……）の不変条件として書く。
- 集約ルート（`DesignRecord`・`ReferenceCheckReport`）が自分の文書（アンカー＋結果）を持ち、`checkComponents(report)` のような門で開いたレポートに `finding`／`skip`／`input` を書かせる。checked の導出と正準順はコマンド自身が守る不変条件で、`compose` のような「閉じる手順」は無い。
- **文言と発生順は golden で凍結**（byte-frozen）。移管は逐語移植。発生順を変えない（レポート合成で `sortedCanonically()` される場合だけループ分割可）。

## 5. published language とアーキテクチャゲート

`tests/architecture/rules.ts` の免除は `PUBLISHED_LANGUAGE` 表 1 つ（11 項目: パス・公開する名前・domain オブジェクトでない理由・利用可能層）。名前ベースの除外や縮小専用台帳はもう無い。**表に項目を足すのは裁定であって便宜ではない**。

| 規則 | 何を違反にするか |
|---|---|
| `no-data-models-in-domain` | プロパティを持つ公開 interface／object 型はすべてデータモデル。**メソッドが添えてあっても免除しない**（red example: `readonly a: string` ＋ `judge()`）。型引数付き `interface X<T>` も拾う |
| `domain-fields-are-private` | domain class の `#` でないフィールド（public・protected・TS private・static・readonly） |
| `published-language-layers` | 表の名前を許可層（原則 `domain` と `adapter`）の外で使うファイル。usecase と entry は公開言語を直接扱わない |

## 6. 外部仕様は変えない、消してよいものの基準

- IR・refinement map・レポート JSON・doctor 出力など、LLM と人間が読む文書の項目は変えない。ツールが読まないことは項目やそれを運ぶフィールドを消す理由にならない（例: `Obligation.ears` は EARS 正規化文で LLM が読む——保持し prose として扱う）。
- 削除してよいのは、文書項目に対応しない in-memory のフィールド／getter で、読み手が I/O にも domain にもゼロのものだけ。必要になった検査と一緒に足せばよい（`RefinementAttribute.min/max`・`DesignAssignments.count`・`RefinementProbe.reqId` の削除はこの基準で追認された）。

## 7. 実装で転ぶところ

- **`#private` の narrowing はクロージャに持ち越せない**: `const variant = this.#variant;` でローカルに受けてから使う。
- **bun の `toEqual` は `#private` を見ない**: class 化した値の比較は `toDocument()` で平文に射影してから行う。
- **カバレッジ床（`bunfig.toml` 0.9）は行と関数の両方、domain 層のみ**: class 化でメソッドが増えたら、アクセサのラウンドトリップテストを足さないと床が落ちる。触った domain ファイルは 100/100 を目標に、既存の未カバー分は main と比較して退行でないことを示す。
- **コミット**: Conventional Commits・英語・叙事スタイル（`refactor: the values own their semantics (ruling 2, unit 1)`）、attribution 行なし。squash マージで件名に `(#番号)`。stacked PR は避ける（base 削除で PR が閉じ、reopen できない）。
- **決定の記録**: `docs/decisions.md` と `.ja.md` の両方に段落を足す（「同 PR」表記、PR 番号は書かない）。裁定は `memory/project.md` の `## Mandated` にも 1 行で。
