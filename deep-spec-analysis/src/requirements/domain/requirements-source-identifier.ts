// RequirementsSourceIdentifier — 要件ソース集約（形式化の根拠となった requirements.md）
// の識別子。要件ソースは 1 インテント記録に 1 つで、恒等は「どの記録の要件か」
// ——値は記録ルートのパス。記録内のどのフェーズ配下に requirements.md が
// 物理配置されているかは解決の詳細であり、Repository が担う。
// 識別子の導出（検証対象成果物のパス → 記録ルート）はパス配置の知識なので
// アダプタが行い、ドメインは受け取った恒等だけを運ぶ。

import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class RequirementsSourceIdentifier {
  readonly #recordRoot: ArtifactPath;

  private constructor(recordRoot: ArtifactPath) {
    this.#recordRoot = recordRoot;
  }

  static of(recordRoot: ArtifactPath): RequirementsSourceIdentifier {
    return new RequirementsSourceIdentifier(recordRoot);
  }

  equals(other: RequirementsSourceIdentifier): boolean {
    return this.#recordRoot.equals(other.#recordRoot);
  }

  recordRoot(): ArtifactPath {
    return this.#recordRoot;
  }
}
