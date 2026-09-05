import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

// stage frontmatterとintent状態が共有するスコープ名。
export class StageScope {
  readonly #value: string;
  /** stage識別名の処理予算は128 UTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length === 0 || value.length > 128)
      throw new IllegalArgumentException({ kind: "invalid-stage-scope-size", raw: value.length });
    if (!/^[a-z][a-z0-9-]*$/.test(value))
      throw new IllegalArgumentException({ kind: "invalid-stage-scope", raw: value });
    this.#value = value;
  }
  static of(value: string): StageScope {
    return new StageScope(value);
  }
  static parse(value: string): Result<StageScope, ParseError> {
    return parseConstruction(() => new StageScope(value));
  }
  equals(other: StageScope): boolean {
    return this.#value === other.#value;
  }
  asString(): string {
    return this.#value;
  }
}
