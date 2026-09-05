import type { AttributePath } from "./attribute-path.ts";
import type { DeclaredBindingValue } from "./declared-binding-value.ts";

// 検査対象の束縛宣言。宣言先の属性パスを持ち、値の適合性は属性宣言と照合する。
export class BindingDeclaration {
  readonly #path: AttributePath;
  readonly #value: DeclaredBindingValue;
  private constructor(path: AttributePath, value: DeclaredBindingValue) {
    this.#path = path;
    this.#value = value;
  }
  static of(path: AttributePath, value: DeclaredBindingValue): BindingDeclaration {
    return new BindingDeclaration(path, value);
  }
  path(): AttributePath { return this.#path; }
  value(): DeclaredBindingValue { return this.#value; }
}
