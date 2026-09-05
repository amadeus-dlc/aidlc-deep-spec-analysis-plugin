import type { AttributePath } from "./attribute-path.ts";
import type { BindingValue } from "./binding-value.ts";

// シナリオ内で属性パスにより同定する束縛。
export class ScenarioBinding {
  readonly #path: AttributePath;
  readonly #value: BindingValue;
  private constructor(path: AttributePath, value: BindingValue) {
    this.#path = path;
    this.#value = value;
  }
  static of(path: AttributePath, value: BindingValue): ScenarioBinding {
    return new ScenarioBinding(path, value);
  }
  path(): AttributePath {
    return this.#path;
  }
  value(): BindingValue {
    return this.#value;
  }
  isFor(path: AttributePath): boolean {
    return this.#path.equals(path);
  }
}
