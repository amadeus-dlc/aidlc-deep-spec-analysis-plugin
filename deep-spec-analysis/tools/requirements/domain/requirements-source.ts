// RequirementsSource 集約 — 形式化の根拠となった requirements.md。id 集合と
// バイト列のダイジェスト、そして原文の生バイト列（原文材料——store の往復則
// findById∘store がバイト恒等）を運ぶ。探索は Repository の解決詳細だが、
// 解決された所在（sourcePath）は store の書き先として集約が保持する。
// digest と原文の整合を守るため、バイト列は構築・照会の両方で防御コピー。

import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";

export interface RequirementsSourceSeed {
  readonly id: RequirementsSourceId;
  readonly sourcePath: ArtifactPath;
  readonly knownIds: RequirementIds;
  readonly digest: string;
  readonly sourceDocument: Uint8Array;
}

export class RequirementsSource {
  readonly #id: RequirementsSourceId;
  readonly #sourcePath: ArtifactPath;
  readonly #knownIds: RequirementIds;
  readonly #digest: string;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: RequirementsSourceSeed) {
    this.#id = seed.id;
    this.#sourcePath = seed.sourcePath;
    this.#knownIds = seed.knownIds;
    this.#digest = seed.digest;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタの解決からの唯一の構築口。
  static reconstitute(seed: RequirementsSourceSeed): RequirementsSource {
    return new RequirementsSource(seed);
  }

  id(): RequirementsSourceId {
    return this.#id;
  }

  // 境界: store の書き先（Repository が解決した所在）。
  sourcePath(): ArtifactPath {
    return this.#sourcePath;
  }

  knownIds(): RequirementIds {
    return this.#knownIds;
  }

  // 境界: 凍結文言の source anchoring と照合されるダイジェスト。
  digest(): string {
    return this.#digest;
  }

  // 境界: store が書く原文（バイト逐語——防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
