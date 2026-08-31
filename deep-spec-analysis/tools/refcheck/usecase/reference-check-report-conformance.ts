// 契約適合サービスポート — 「書き手は不適合ファイルを決して出さない」の
// クエリ面。Repository の store は同じ適合を内包するが、report-only モード
// （書かない発火）でも verdict は「書かれるはずの姿」から導く必要があるため、
// 適合だけを問える別ポートに分離する（Repository のメソッドは永続化語彙のみ
// ——オーナー裁定）。
//
// 実装は Repository と同じアダプタが担い、store が書く姿と常に一致する。

import type { ReferenceCheckReport } from "../domain/index.ts";

export interface ReferenceCheckReportConformance {
  conformedOf(report: ReferenceCheckReport): ReferenceCheckReport;
}
