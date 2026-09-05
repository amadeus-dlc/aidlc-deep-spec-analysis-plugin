import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { assertValueSize, parseConstruction, type Result, } from "@deep-spec/kernel-infrastructure";
import type { AttributeKind } from "./attribute-kind.ts";

// IRに記述された束縛値。論理値でない記述も、適合検査で診断するため保持する。
type Declaration = null | boolean | number | string | readonly Declaration[] | { readonly [key: string]: Declaration };

export class DeclaredBindingValue {
  readonly #value: Declaration;

  /** 診断値1件の予算: 文字列4,096、全テキスト65,536コード単位、4,096ノード、深さ32。 */
  private constructor(value: Declaration) {
    assertValueSize(value, { string: 4096, total: 65_536, nodes: 4096, depth: 32 });
    this.#value = structuredClone(value);
  }

  static of(value: Declaration): DeclaredBindingValue { return new DeclaredBindingValue(value); }

  // 入力に由来するサイズ超過は想定内。宣言値自身の構築契約だけをResultへ変換する。
  static parse(value: Declaration): Result<DeclaredBindingValue, ParseError> { return parseConstruction(() => new DeclaredBindingValue(value)); }

  fits(kind: AttributeKind, admitsEnum: (value: string) => boolean): boolean {
    return (kind.isBool() && typeof this.#value === "boolean") ||
      (kind.isInt() && typeof this.#value === "number" && Number.isSafeInteger(this.#value)) ||
      (kind.isEnum() && typeof this.#value === "string" && admitsEnum(this.#value));
  }

  match<T>(cases: { literal: (value: boolean | number | string) => T; nonLiteral: () => T }): T {
    if (typeof this.#value === "boolean" || typeof this.#value === "number" || typeof this.#value === "string") return cases.literal(this.#value);
    return cases.nonLiteral();
  }

  describe(): string { return JSON.stringify(this.#value); }
}
