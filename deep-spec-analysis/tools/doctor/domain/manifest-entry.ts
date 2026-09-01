import type { CheckSeverity } from "./check-severity.ts";

// インストール必須ファイル 1 件——harness ルートからの相対パスと深刻度。
export interface ManifestEntry {
  rel: string;
  severity: CheckSeverity;
}
