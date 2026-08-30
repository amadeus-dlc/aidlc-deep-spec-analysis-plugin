// RequirementsSourceId — 要件ソース集約（形式化の根拠となった requirements.md）
// の識別子。要件ソースは 1 インテント記録に 1 つで、恒等は「どの記録の要件か」
// ——値は記録ルートのパス。記録内のどのフェーズ配下に requirements.md が
// 物理配置されているかは解決の詳細であり、Repository が担う。
// 識別子の導出（検証対象成果物のパス → 記録ルート）はパス配置の知識なので
// アダプタが行い、ドメインは受け取った恒等だけを運ぶ。

export class RequirementsSourceId {
  readonly #recordRoot: string;

  private constructor(recordRoot: string) {
    this.#recordRoot = recordRoot;
  }

  static of(recordRoot: string): RequirementsSourceId {
    return new RequirementsSourceId(recordRoot);
  }

  equals(other: RequirementsSourceId): boolean {
    return this.#recordRoot === other.#recordRoot;
  }

  // 境界: Repository が探索起点（記録ルート）を導出するための識別子の値。
  recordRoot(): string {
    return this.#recordRoot;
  }
}
