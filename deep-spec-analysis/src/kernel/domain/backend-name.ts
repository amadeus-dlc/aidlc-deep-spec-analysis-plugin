import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// BackendName — 検証バックエンド名（smt / quint / cross-check / components …）
// のドメインプリミティブ。レポート id の派生名・crossChecked 判定表・比較表の
// キーとして全コンテキストが話す共有語彙。

export class BackendName {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "backend-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-backend-name", raw });
    this.#value = raw;
  }

  static of(raw: string): BackendName {
    return new BackendName(raw);
  }

  static parse(raw: string): Result<BackendName, ParseError> {
    return parseConstruction(() => new BackendName(raw));
  }

  equals(other: BackendName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
