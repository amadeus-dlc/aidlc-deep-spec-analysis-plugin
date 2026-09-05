// functional-design（entities.md / rules.md / functional-spec.md）と
// 横断検査（XS）向け domain-design エンティティのドメインオブジェクト。
// 解析（fence/YAML/mermaid/Json 歩き）はアダプタのパーサが行い、ここは
// 宣言が自分の整合性判定（型区分の衝突・範囲逆転・参照解決・被覆差分）を
// 所有する抽象データ型——検査ランナーは尋ねず（ask）、告げる（tell）だけ。
// 配列を生で運ばない：集合の知識（重複・差分・解決・選定）はファースト
// クラスコレクションが所有し、toArray() は境界（描画・アダプタ）専用の
// 脱出口。判定の意味論と文言の描画形は旧 functional-checks の凍結挙動の
// 逐語移設。

