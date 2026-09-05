import { IllegalArgumentException, parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";

// 1件の検査診断。文言が同じ診断も別々の発生としてコレクションに保持する。
export class ErrorMessage {
  readonly #value: string;

  /** 1件の診断表示の処理予算は65,536 UTF-16コード単位。 */
  private constructor(value: string) {
    if (value.length > 65_536) throw new IllegalArgumentException({ kind: "error-message-too-long", raw: value.length });
    if (value.length === 0) throw new IllegalArgumentException({ kind: "empty-error-message" });
    this.#value = value;
  }

  static of(value: string): ErrorMessage { return new ErrorMessage(value); }
  static parse(value: string): Result<ErrorMessage, ParseError> { return parseConstruction(() => new ErrorMessage(value)); }
  asString(): string { return this.#value; }
}
