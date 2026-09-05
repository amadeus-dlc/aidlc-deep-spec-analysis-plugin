import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class BackgroundAssumptionId {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-background-id", raw });
    this.#value = raw;
  }

  static of(raw: string): BackgroundAssumptionId {
    return new BackgroundAssumptionId(raw);
  }

  static parse(raw: string): Result<BackgroundAssumptionId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new BackgroundAssumptionId(raw));
  }

  equals(other: BackgroundAssumptionId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
