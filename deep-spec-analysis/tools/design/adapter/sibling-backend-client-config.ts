export interface SiblingBackendClientConfig {
  readonly toolsDirectory: string;
  readonly workingDirectory: string;
  // 子プロセスへ渡す環境（省略時は親の環境を継ぐ——旧挙動）。合成ルートが
  // 決定論条件を固定したいとき（テストハーネス等）だけ明示注入する。
  readonly spawnEnvironment?: { readonly [k: string]: string | undefined };
}
