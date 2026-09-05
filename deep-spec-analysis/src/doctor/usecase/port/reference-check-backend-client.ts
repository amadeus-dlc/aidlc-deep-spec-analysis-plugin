// refcheck センサーの report-only 実行ポート。実装は adapter の子プロセス
// spawn 維持（故障隔離・15s timeout 意味論の保存——移行 PR9、#22）。
// 返りは findings_count、実行不能（ツール欠如・非 0 exit・壊れた verdict）は
// null——「数えられなかった」を 0 と混同しない。
export interface ReferenceCheckBackendClient {
  reportOnlyFindings(tool: string, artifactPath: string): number | null;
}
