# Tell-Don't-Ask — 判断は状態の所有者へ

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/tell-dont-ask.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 原則

呼び出し側が値を取り出して業務判断を再実装するより、その状態を所有する型へ判断を依頼する。getterの存在を一律に禁じる規則ではない。

公開する前に次の順で検討する。

1. 状態を外へ出さず、型自身の操作で完結できないか。
2. 生値ではなく、ドメインの意味を持つ問いや判断結果を返せないか。
3. 外部契約への変換が必要なら、その境界と必要性を明記できるか。

- `value`・`inner`・`raw`など、内部型を意識させるだけのアクセサを増やさない。
- `asString`など既存の境界変換は、用途が必要な場合に使う。業務判断を外へ出す免罪符にしない。
- adapterの描画・プロトコル変換と、ドメインの判断を区別する。
- unionや状態分岐は所有する型の振る舞いへ集約し、同じ分岐を呼び出し側へ散らさない。

関連: [フィールド可視性](field-visibility.md)、[ドメイン同値](domain-equality.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
