// ReferenceCheckReport の永続化ポート。実装はアダプタ層の
// ReferenceCheckReportRepositoryImpl（契約2 自己検証＋unavailable 降格＋
// 正準描画を内部詳細として持つ）。save は書かれた文書の実数を返す——
// 呼び手の verdict がファイルと矛盾し得ないための命令レシート
//（公認の CQS 逸脱、設計文書 §5 参照）。

import type { EmitResult, RefcheckDoc } from "../domain/index.ts";

export interface ReferenceCheckReportRepository {
  save(outDir: string, doc: RefcheckDoc, reportOnly: boolean): EmitResult;
}
