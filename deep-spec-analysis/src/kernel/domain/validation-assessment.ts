import type { ErrorMessages } from "./error-messages.ts";

// 検査の診断と合否を一緒に保持する。表示用の文字列列への変換はadapterで行う。
export class ValidationAssessment {
  readonly #errors: ErrorMessages;

  private constructor(errors: ErrorMessages) {
    this.#errors = errors;
  }

  static of(errors: ErrorMessages): ValidationAssessment {
    return new ValidationAssessment(errors);
  }

  passes(): boolean {
    return this.#errors.isEmpty();
  }

  errors(): ErrorMessages {
    return this.#errors;
  }
}
