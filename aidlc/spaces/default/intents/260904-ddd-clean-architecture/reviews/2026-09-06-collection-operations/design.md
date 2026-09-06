# ファーストクラスコレクションの共通操作

ユーザーは、空判定だけのインターフェイスではなく、Scalaのコレクションのように型付きの要素操作を共通契約として使うことを指定した。作業ブランチはrefactor/collection-operations、基線はmainの928dd730b66261c5e798aef58f96c11739395f30。

## 承認された操作契約

NonEmptyFirstClassCollection<E>を基底のinterfaceにし、FirstClassCollection<E>が継承してisEmptyを追加する。共通操作はat、head、tail、include、exists、filter、map。interfaceに別のSelf型引数や、mapの生成先factory引数を要求しない。

```ts
interface NonEmptyFirstClassCollection<E extends Equatable<E>> extends Iterable<E> {
  at(index: number): E;
  head(): E;
  tail(): FirstClassCollection<E>;
  include(element: E): boolean;
  exists(predicate: (element: E) => boolean): boolean;
  filter(predicate: (element: E) => boolean): FirstClassCollection<E>;
  map<U extends Equatable<U>>(transform: (element: E) => U): FirstClassCollection<U>;
}

interface FirstClassCollection<E extends Equatable<E>> extends NonEmptyFirstClassCollection<E> {
  isEmpty(): boolean;
}
```

要素Eと変換先Uはequalsを持つドメイン型に限定する案を、確認ツールでユーザーが選択した。includeを参照同一性で実装せず、要素が所有する値同値またはエンティティ識別子の同値を用いる。一般のドメインオブジェクトをJSON化して比較する方法は採用しない。

非空の具体型はof(head, tail)とコンストラクタで構築契約を維持する。head/atの前提違反はpanic相当、existsは短絡し空のときfalse。tail/filterは空になり得るため空可のコレクションを返す。通常の具体型は再構築hookでtail/filterの具体型を保つ。mapは変換後の要素型の汎用不変コレクションを返す。

## 共通化と型固有の責務

走査・位置アクセス・短絡・要素変換のアルゴリズムは共通実装へ集約する。具体的なドメインコレクションは反復の要素、再構築、順序、一意性、件数上限、ownerやキーの対応を所有する。実装基盤では具体型を保つ型引数を使えるが、利用者向けinterfaceはEだけとする。

索引やカタログは値配列だけへ落とすとキーや所属を失うため、論理要素と再構築方法を個別に設計する。ドメイン固有の要素クラスが必要な関連付けを保持し、生のプリミティブやタプルで置き換えない。

## 件数予算

この実装では、既存最大規模に合わせて共通上限を65,536要素とし、各具象型のより厳しい上限は維持する。構築時の予算も整合させ、生成できた集合が共通操作の予算で拒否される不整合を解消する。配列長の事前確認と読取中の上限確認を行い、検証したスナップショットを保持する。数値そのものは共通の原理ではなく、この実装の設計判断である。

## 横展開と検証

既存112型の一覧は[inventory-before.json](inventory-before.json)。kernel、design、requirements/refcheck/doctorに分けてLuna maxへ実装を委譲し、親が全件監査・統合・既存テストの移行・最終レビューを担当する。

公開APIで位置境界、空head/tail、existsの短絡、別インスタンスの値同値、変換後要素型、順序、元集合の不変性、具体型の再構築、不変条件の維持を検証する。型検査ではequalsを持たない要素と型の取り違えを拒否する。既存のof/parse、ユースケース境界、診断出力の契約を保つ。

## 参考

[Scalaのコレクション設計](https://docs.scala-lang.org/overviews/core/architecture-of-scala-213-collections.html)は、要素型を保つ操作と変える操作の戻り型、共通実装と具体型のfactoryを区別している。[IterableOps](https://www.scala-lang.org/api/current/scala/collection/IterableOps.html)にexistsのBoolean契約が定義されている。
