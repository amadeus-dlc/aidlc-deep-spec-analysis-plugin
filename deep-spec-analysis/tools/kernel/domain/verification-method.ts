// VerificationMethod — findings 文書（契約2）の method（exhaustive / bounded /
// simulation / static）のドメインプリミティブ（種別規律の裁定 3-2、2026-09-03）。
// 値はバックエンドが決め、文書へは asString で降りる。

export class VerificationMethod {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): VerificationMethod {
    return new VerificationMethod(raw);
  }

  equals(other: VerificationMethod): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
