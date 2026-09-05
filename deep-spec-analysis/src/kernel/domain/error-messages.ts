import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import type { ErrorMessage } from "./error-message.ts";

// 診断の発生順と所有権を保持する。文字列の構築契約はErrorMessageが担う。

export class ErrorMessages {
  readonly #values: readonly ErrorMessage[];

  private constructor(values: readonly ErrorMessage[]) {
    if (values.length > 65_536) throw new IllegalArgumentException({ kind: "too-many-error-messages", raw: values.length });
    // 空配列は「エラーなし」を表す有効な値。
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly ErrorMessage[]): ErrorMessages {
    return new ErrorMessages(values);
  }

  add(value: ErrorMessage): ErrorMessages {
    return new ErrorMessages([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ErrorMessage> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly ErrorMessage[] {
    return this.#values;
  }
}
