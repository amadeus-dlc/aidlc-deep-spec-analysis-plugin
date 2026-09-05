import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// DesignModel内のユニット識別子。非空の名前を保持し、
// 生値からの入力失敗はparse、内部の生成契約違反はofのpanicで扱う。

export class DesignUnitIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 128) throw new IllegalArgumentException({ kind: "design-unit-id-too-long", raw: value.length });
    if (value === "") throw new IllegalArgumentException({ kind: "empty-design-unit-id", raw: value });
    this.#value = value;
  }

  static of(value: string): DesignUnitIdentifier {
    return new DesignUnitIdentifier(value);
  }

  static parse(raw: string): Result<DesignUnitIdentifier, ParseError> {
    return parseConstruction(() => new DesignUnitIdentifier(raw));
  }

  equals(other: DesignUnitIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 境界: 文書・文言・写像キーに逐語で載るユニット名。
  asString(): string {
    return this.#value;
  }
}
