// RequirementsSource 集約 — 形式化の根拠となった requirements.md。id 集合と
// バイト列のダイジェスト、そして原文の生バイト列（原文材料——store の往復則
// findById∘store がバイト恒等）を運ぶ。探索は Repository の解決詳細だが、
// 解決された所在（sourcePath）は store の書き先として集約が保持する。
// digest と原文の整合を守るため、バイト列は構築・照会の両方で防御コピー。

import { type ArtifactPath, type RequirementIdentifiers, ContentHash } from "@deep-spec/kernel-domain";
import type { RequirementsSourceIdentifier } from "./requirements-source-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RequirementsSourceParam = {
  readonly id: RequirementsSourceIdentifier;
  readonly sourcePath: ArtifactPath;
  readonly knownIds: RequirementIdentifiers;
  readonly digest: ContentHash;
  readonly sourceDocument: Uint8Array;
};

export class RequirementsSource {
  readonly #id: RequirementsSourceIdentifier;
  readonly #sourcePath: ArtifactPath;
  readonly #knownIds: RequirementIdentifiers;
  readonly #digest: ContentHash;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: RequirementsSourceParam) {
    this.#id = seed.id;
    this.#sourcePath = seed.sourcePath;
    this.#knownIds = seed.knownIds;
    this.#digest = seed.digest;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタの解決からの唯一の構築口。
  static of(seed: RequirementsSourceParam): RequirementsSource {
    return new RequirementsSource(seed);
  }

  id(): RequirementsSourceIdentifier {
    return this.#id;
  }

  // 境界: store の書き先（Repository が解決した所在）。
  sourcePath(): ArtifactPath {
    return this.#sourcePath;
  }

  knownIds(): RequirementIdentifiers {
    return this.#knownIds;
  }

  // 境界: 凍結文言の source anchoring と照合されるダイジェスト。
  digest(): ContentHash {
    return this.#digest;
  }

  // 境界: store が書く原文（バイト逐語——防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
