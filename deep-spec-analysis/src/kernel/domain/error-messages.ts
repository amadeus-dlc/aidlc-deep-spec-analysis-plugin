import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { ErrorMessage } from "./error-message.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";

// 診断の発生順と所有権を保持する。文字列の構築契約はErrorMessageが担う。
const MAX_MESSAGES = 65_536;

export class ErrorMessages
  extends FirstClassCollectionBase<ErrorMessage, ErrorMessages>
  implements FirstClassCollection<ErrorMessage>
{
  readonly #values: readonly ErrorMessage[];

  private constructor(values: readonly ErrorMessage[]) {
    super();
    // 空配列は「エラーなし」を表す有効な値。
    this.#values = boundedCollectionSnapshot(values, MAX_MESSAGES, "too-many-error-messages");
  }

  protected rebuild(values: readonly ErrorMessage[]): ErrorMessages {
    return new ErrorMessages(values);
  }

  static parse(values: readonly ErrorMessage[]): Result<ErrorMessages, ParseError> {
    return parseConstruction(() => new ErrorMessages(values));
  }

  static of(values: readonly ErrorMessage[]): ErrorMessages {
    return new ErrorMessages(values);
  }

  // 診断の表現予算を超えても検査そのものをpanicで失わない。
  // parse失敗と件数超過は明示的な診断を残し、通常のof/parse契約は緩めない。
  static collect(diagnostics: Iterable<Result<ErrorMessage, ParseError>>): ErrorMessages {
    const values: ErrorMessage[] = [];
    for (const diagnostic of diagnostics) {
      if (values.length === MAX_MESSAGES) {
        values[values.length - 1] = ErrorMessage.of(
          "validation diagnostic limit reached (65536 messages); additional diagnostics omitted",
        );
        break;
      }
      values.push(
        diagnostic.ok
          ? diagnostic.value
          : ErrorMessage.of("validation diagnostic could not be represented within its text budget"),
      );
    }
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
