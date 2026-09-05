import type { AttributeKind } from "./attribute-kind.ts";
import type { Declaration } from "./declaration.ts";

// IRに記述された束縛値。論理値でない記述も、適合検査で診断するため保持する。
export class DeclaredBindingValue {
  readonly #value: Declaration;

  private constructor(value: Declaration) {
    this.#value = value;
  }

  static of(value: Declaration): DeclaredBindingValue {
    return new DeclaredBindingValue(value);
  }

  fits(kind: AttributeKind, admitsEnum: (value: string) => boolean): boolean {
    return this.#value.match({
      literal: (value) => (kind.isBool() && typeof value === "boolean") ||
        (kind.isInt() && typeof value === "number" && Number.isSafeInteger(value)) ||
        (kind.isEnum() && typeof value === "string" && admitsEnum(value)),
      nonLiteral: () => false,
    });
  }

  match<T>(cases: { literal: (value: boolean | number | string) => T; nonLiteral: () => T }): T {
    return this.#value.match(cases);
  }

  describe(): string { return this.#value.describe(); }
}
