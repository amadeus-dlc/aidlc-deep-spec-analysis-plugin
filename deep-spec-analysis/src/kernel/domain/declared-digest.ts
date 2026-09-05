import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { ContentHash } from "./content-hash.ts";

// 文書に記されたダイジェストの原文。検証済み ContentHash へ昇格させず、
// 実測値との一致・不一致を判断するための入力として保持する。
export class DeclaredDigest {
  readonly #value: string;

  /** 4096 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "declared-digest-too-long", raw: value.length });
    this.#value = value;
  }

  static parse(value: string): Result<DeclaredDigest, ParseError> {
    return parseConstruction(() => new DeclaredDigest(value));
  }

  static of(value: string): DeclaredDigest {
    return new DeclaredDigest(value);
  }

  asString(): string {
    return this.#value;
  }

  matches(actual: ContentHash): boolean {
    return this.#value === actual.asString();
  }
}
