import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

export class FindingCount {
  readonly #value: number;
  /** doctorが扱う1成果物の診断予算は100万件。65,536成果物の合計もsafe integerに収まる。 */
  private constructor(value: number) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000)
      throw new IllegalArgumentException({ kind: "invalid-finding-count", raw: value });
    this.#value = value;
  }
  static of(value: number): FindingCount {
    return new FindingCount(value);
  }
  static parse(value: number): Result<FindingCount, ParseError> {
    return parseConstruction(() => new FindingCount(value));
  }
  isEmpty(): boolean {
    return this.#value === 0;
  }
  asNumber(): number {
    return this.#value;
  }
}
