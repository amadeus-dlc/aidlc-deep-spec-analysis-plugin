import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// 検証方法（exhaustive / bounded / simulation / static）。
// 新規生成も文書の復元も同じ閉集合の契約を通る。

const KNOWN_METHODS: ReadonlySet<string> = new Set(["exhaustive", "bounded", "simulation", "static"]);

export class VerificationMethod {
  readonly #value: string;

  /** 閉集合で最長の exhaustive の文字数。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 10) throw new IllegalArgumentException({ kind: "unknown-verification-method", raw });
    if (!KNOWN_METHODS.has(raw)) throw new IllegalArgumentException({ kind: "unknown-verification-method", raw });
    this.#value = raw;
  }

  static of(raw: string): VerificationMethod {
    return new VerificationMethod(raw);
  }

  static parse(raw: string): Result<VerificationMethod, ParseError> {
    return parseConstruction(() => new VerificationMethod(raw));
  }

  equals(other: VerificationMethod): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
