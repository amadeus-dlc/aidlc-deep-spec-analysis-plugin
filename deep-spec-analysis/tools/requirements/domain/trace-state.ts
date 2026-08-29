// decode 済みトレース状態の語彙。ITF という形式の知識はアダプタが持ち、
// ドメインには「属性パス → 復号済み値」の型付きデータだけが届く。
// 値は原理上ネスト構造も通る（旧実装の decode の素通し挙動を保存）。

export type DecodedValue = null | boolean | number | string | DecodedValue[] | { [k: string]: DecodedValue };

export type TraceState = { [path: string]: DecodedValue };
