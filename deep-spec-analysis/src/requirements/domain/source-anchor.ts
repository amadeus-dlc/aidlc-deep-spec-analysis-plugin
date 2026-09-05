import type { ContentHash, DeclaredDigest } from "@deep-spec/kernel-domain";
// SourceAnchor — IR が形式化の根拠とした requirements.md のバイト列に対する
// 錨（sha256）。編集の検出を mtime ではなく内容で行うための語彙。
// ダイジェストの算出そのものはバイト列を読むアダプタの責務で、ここは宣言値と
// 実測値の突き合わせだけを持つ。旧 ir-valid の source anchoring 節の逐語移植。

export class SourceAnchor {
  readonly #declared: DeclaredDigest | null;
  readonly #actual: ContentHash;

  private constructor(declared: DeclaredDigest | null, actual: ContentHash) {
    this.#declared = declared;
    this.#actual = actual;
  }

  // declared は IR の sourceDigest（文字列でなければ null で届く）。
  static of(declared: DeclaredDigest | null, actual: ContentHash): SourceAnchor {
    return new SourceAnchor(declared, actual);
  }

  errors(): string[] {
    if (this.#declared === null) {
      return [
        `IR has no sourceDigest — requirements drift would be undetectable; add "sourceDigest": "${this.#actual.asString()}" (sha256 of requirements.md) to the IR`,
      ];
    }
    if (!this.#declared.matches(this.#actual)) {
      return [
        `sourceDigest ${this.#declared.asString()} does not match requirements.md (sha256 ${this.#actual.asString()}) — the requirements changed since formalization; re-formalize against the current text and restamp the digest`,
      ];
    }
    return [];
  }
}
