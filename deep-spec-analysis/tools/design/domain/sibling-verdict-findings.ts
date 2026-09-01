import type { SiblingVerdictFinding } from "./sibling-verdict-finding.ts";

// 兄弟バックエンド判定 finding のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictFindings {
  readonly #values: readonly SiblingVerdictFinding[];

  private constructor(values: readonly SiblingVerdictFinding[]) {
    this.#values = values;
  }

  static of(values: readonly SiblingVerdictFinding[]): SiblingVerdictFindings {
    return new SiblingVerdictFindings([...values]);
  }

  add(value: SiblingVerdictFinding): SiblingVerdictFindings {
    return new SiblingVerdictFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SiblingVerdictFinding> {
    yield* this.#values;
  }

  toArray(): readonly SiblingVerdictFinding[] {
    return this.#values;
  }
}
