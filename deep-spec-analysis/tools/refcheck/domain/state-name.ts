import { Names } from "../../kernel/domain/index.ts";
import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class StateName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<StateName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new StateName(raw));
  }
  static reconstitute(raw: string): StateName { return new StateName(raw); }
  equals(other: StateName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): string { return Names.normalize(this.#value); }
}
