// 構造負債走査の問題 1 行——参照整合 finding を抱える設計成果物。
export interface DebtRow {
  space: string;
  intent: string;
  artifact: string;
  findings: number;
}
