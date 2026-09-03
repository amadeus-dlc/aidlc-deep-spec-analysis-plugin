import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type BackgroundAssumptionIdError = { readonly kind: "empty-background-id"; readonly raw: string };

export class BackgroundAssumptionId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<BackgroundAssumptionId, BackgroundAssumptionIdError> {
    if (raw === "") return err({ kind: "empty-background-id", raw });
    return ok(new BackgroundAssumptionId(raw));
  }

  static reconstitute(raw: string): BackgroundAssumptionId {
    return new BackgroundAssumptionId(raw);
  }

  equals(other: BackgroundAssumptionId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
