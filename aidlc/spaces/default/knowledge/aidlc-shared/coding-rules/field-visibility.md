# フィールドはprivate — 判断を外へ流出させない

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/field-visibility.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 規則

- ドメインオブジェクトの状態は`#field`で隠す。公開フィールドや公開setterで不変条件を迂回させない。
- private化と同時に、全フィールド分のgetterを機械的に追加しない。まず型自身の操作や判断として公開できないか検討する。
- 境界で読み出す必要がある場合だけ、意味のあるメソッドを設ける。`get`アクセサは使わない。
- `readonly`は参照先のオブジェクト全体を不変にする保証ではない。入力・出力の所有権を確認し、必要なコピーや凍結で状態を保護する。
- 構築に必要な値はコンストラクタへ渡す。初期化途中のオブジェクトを公開しない。

## 適用範囲

ドメインのクラスが対象。adapterの外部DTO、portの入出力契約、汎用の判別union、明示されたPublished Languageへ、クラスのprivateフィールド規則をそのまま適用しない。型の役割は既存の層規則と許可表で判断する。

関連: [Tell-Don't-Ask](tell-dont-ask.md)、[内部可変性](interior-mutability.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
