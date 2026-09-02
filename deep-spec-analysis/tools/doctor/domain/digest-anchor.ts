import type { ContentHash } from "../../kernel/domain/index.ts";

// 検証時に記録した要件ダイジェストと現在のダイジェストの対——失効は内容
// だけで決める（mtime では決めない）。（#71 波27）
export class DigestAnchor {
  readonly #expected: ContentHash;
  readonly #actual: ContentHash;

  private constructor(expected: ContentHash, actual: ContentHash) {
    this.#expected = expected;
    this.#actual = actual;
  }

  static of(expected: ContentHash, actual: ContentHash): DigestAnchor {
    return new DigestAnchor(expected, actual);
  }

  isStale(): boolean {
    return !this.#expected.equals(this.#actual);
  }
}
