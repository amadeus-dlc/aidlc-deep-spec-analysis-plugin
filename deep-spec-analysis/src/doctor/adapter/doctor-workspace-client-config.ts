export interface DoctorWorkspaceClientConfig {
  readonly projectDir: string;
  readonly root: string;
  // 構造負債スキャンが spawn する refcheck entry（配布物）の basename。
  // 出荷形——tools/<entry>.ts——を知るのは合成ルートだけ。
  readonly refcheckToolNames: {
    readonly domain: string;
    readonly contract: string;
    readonly functional: string;
  };
}
