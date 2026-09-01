import { Names } from "../../kernel/domain/index.ts";
import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class AllowedValue {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AllowedValue, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AllowedValue(raw));
  }
  static reconstitute(raw: string): AllowedValue { return new AllowedValue(raw); }
  equals(other: AllowedValue): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): string { return Names.normalize(this.#value); }
}
