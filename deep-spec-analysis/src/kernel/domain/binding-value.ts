import {
  err,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { DeclaredBindingValue } from "./declared-binding-value.ts";
import type { Expression } from "./expression.ts";

// シナリオで属性へ束縛できる論理値。整数は全バックエンドで正確に運べる範囲に限る。
export class BindingValue {
  readonly #value: boolean | number | string;

  private constructor(value: boolean | number | string) {
    if (typeof value === "string" && value.length > 4096)
      throw new IllegalArgumentException({ kind: "binding-literal-too-long", raw: value.length });
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new IllegalArgumentException({ kind: "invalid-binding-integer", raw: value });
    }
    this.#value = value;
  }

  static of(value: boolean | number | string): BindingValue {
    return new BindingValue(value);
  }

  static parse(value: boolean | number | string): Result<BindingValue, ParseError> {
    return parseConstruction(() => new BindingValue(value));
  }

  // 束縛宣言を論理値に昇格する。文字列の別名ファクトリではなく、宣言の解決操作。
  static resolve(declaration: DeclaredBindingValue): Result<BindingValue, string> {
    return declaration.match<Result<BindingValue, string>>({
      literal: (value) => {
        const result = BindingValue.parse(value);
        return result.ok ? result : err(JSON.stringify(result.error));
      },
      nonLiteral: () => err(`binding value ${declaration.describe()} is not a boolean, safe integer, or enum literal`),
    });
  }

  toDocument(): boolean | number | string {
    return this.#value;
  }

  equals(other: BindingValue): boolean {
    return this.#value === other.#value;
  }

  match<T>(cases: { bool: (value: boolean) => T; int: (value: number) => T; enum: (value: string) => T }): T {
    if (typeof this.#value === "boolean") return cases.bool(this.#value);
    if (typeof this.#value === "number") return cases.int(this.#value);
    return cases.enum(this.#value);
  }

  asExpression(): Expression {
    return this.match<Expression>({
      bool: (value) => ({ op: "bool", value }),
      int: (value) => ({ op: "int", value }),
      enum: (value) => ({ op: "enum", value }),
    });
  }
}
