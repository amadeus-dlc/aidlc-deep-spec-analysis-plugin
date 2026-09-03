// 検査実行モード — 閉じた語彙。"persist" は報告書を書き verdict を導出する
// 通常運転、"report-only" は doctor 用（計算と報告のみ、何も書かない）。
// 旧 reportOnly: boolean の置換（基本データ型を Input に持たせない裁定）。

export type CheckExecutionMode = "persist" | "report-only";
