import type { AttributePath } from "@deep-spec-analysis/kernel-domain";
import type { TraceValue } from "./trace-value.ts";

// トレース状態の索引項目。属性パスを落とすと toDocument/valueAt の意味を保てないため、
// 状態の共通操作はこの座標付き要素を反復する。
export class TraceStateEntry {
  readonly #path: AttributePath;
  readonly #value: TraceValue;

  private constructor(path: AttributePath, value: TraceValue) {
    this.#path = path;
    this.#value = value;
  }

  static of(path: AttributePath, value: TraceValue): TraceStateEntry {
    return new TraceStateEntry(path, value);
  }

  path(): AttributePath {
    return this.#path;
  }

  value(): TraceValue {
    return this.#value;
  }

  equals(other: TraceStateEntry): boolean {
    return this.#path.equals(other.#path) && this.#value.equals(other.#value);
  }
}
