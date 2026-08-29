// 設計コンテキストの素通し値語彙。契約3 のエンティティスキーマ断片
// （lowering がそのまま契約1 文書へ埋め込む）と、v1 判定文書から remap で
// 受け継ぐ witness を、型付きデータとして運ぶ（Json 型はドメイン禁止——
// requirements/domain の DecodedValue と同じ前例）。

export type DesignValue = null | boolean | number | string | DesignValue[] | { [k: string]: DesignValue };
