export interface SiblingBackendClientConfig {
  // 兄弟 v1 entry（配布物）の実パス。出荷形——tools/<entry>.ts という
  // バンドル名——を知るのは合成ルートだけで、層はファイル名を組み立てない。
  readonly siblingToolPaths: { readonly smt: string; readonly quint: string };
  readonly workingDirectory: string;
  // 子プロセスへ渡す環境（省略時は親の環境を継ぐ——旧挙動）。合成ルートが
  // 決定論条件を固定したいとき（テストハーネス等）だけ明示注入する。
  readonly spawnEnvironment?: { readonly [k: string]: string | undefined };
}
