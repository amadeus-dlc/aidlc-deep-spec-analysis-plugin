// SourceAnchor — IR が形式化の根拠とした requirements.md のバイト列に対する
// 錨（sha256）。編集の検出を mtime ではなく内容で行うための語彙。
// ダイジェストの算出そのものはバイト列を読むアダプタの責務で、ここは宣言値と
// 実測値の突き合わせだけを持つ。旧 ir-valid の source anchoring 節の逐語移植。

export class SourceAnchor {
  readonly #declared: string | null;
  readonly #actual: string;

  private constructor(declared: string | null, actual: string) {
    this.#declared = declared;
    this.#actual = actual;
  }

  // declared は IR の sourceDigest（文字列でなければ null で届く）。
  static of(declared: string | null, actual: string): SourceAnchor {
    return new SourceAnchor(declared, actual);
  }

  errors(): string[] {
    if (this.#declared === null) {
      return [
        `IR has no sourceDigest — requirements drift would be undetectable; add "sourceDigest": "${this.#actual}" (sha256 of requirements.md) to the IR`,
      ];
    }
    if (this.#declared !== this.#actual) {
      return [
        `sourceDigest ${this.#declared} does not match requirements.md (sha256 ${this.#actual}) — the requirements changed since formalization; re-formalize against the current text and restamp the digest`,
      ];
    }
    return [];
  }
}
