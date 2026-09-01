// harness ツリー上のファイル実在検査ポート。実装は adapter（existsSync）。
export interface HarnessFileClient {
  isInstalled(rel: string): boolean;
}
