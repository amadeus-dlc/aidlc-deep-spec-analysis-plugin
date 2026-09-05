import {
  boundedValueSnapshot, canonicalStringify, IllegalArgumentException, parseConstruction,
  type Json, type ParseError, type Result,
} from "@deep-spec/kernel-infrastructure";

// 未検証の入力表現。Declarationクラスと区別し、他のドメイン型の構築引数にはしない。
type DeclarationParam = Json;

// 宣言に記述された値。表現のサイズと数値の有限性、スナップショットの所有権を保証する。
// bool/int/enumの属性へ適合するかという判断は、束縛値と属性宣言が担う。
export class Declaration {
  readonly #value: Json;

  /** 文字列4,096、全テキスト65,536コード単位、4,096ノード、深さ32。 */
  private constructor(value: DeclarationParam) {
    const snapshot = boundedValueSnapshot(value, { string: 4096, total: 65_536, nodes: 4096, depth: 32 });
    const checkNumbers = (current: Json): void => {
      if (typeof current === "number" && !Number.isFinite(current)) {
        throw new IllegalArgumentException({ kind: "non-finite-declaration-number", raw: current });
      }
      if (Array.isArray(current)) {
        for (const child of current) checkNumbers(child);
      } else if (current !== null && typeof current === "object") {
        for (const child of Object.values(current)) checkNumbers(child);
      }
    };
    checkNumbers(snapshot);
    this.#value = snapshot;
  }

  static of(value: DeclarationParam): Declaration {
    return new Declaration(value);
  }
  static parse(value: DeclarationParam): Result<Declaration, ParseError> {
    return parseConstruction(() => new Declaration(value));
  }

  match<T>(cases: { literal: (value: boolean | number | string) => T; nonLiteral: () => T }): T {
    if (typeof this.#value === "boolean" || typeof this.#value === "number" || typeof this.#value === "string") return cases.literal(this.#value);
    return cases.nonLiteral();
  }

  equals(other: Declaration): boolean { return canonicalStringify(this.#value) === canonicalStringify(other.#value); }
  describe(): string { return JSON.stringify(this.#value); }
}
