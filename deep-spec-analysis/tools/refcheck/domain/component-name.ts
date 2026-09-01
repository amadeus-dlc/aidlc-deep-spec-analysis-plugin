import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class ComponentName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ComponentName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ComponentName(raw));
  }
  static reconstitute(raw: string): ComponentName { return new ComponentName(raw); }
  equals(other: ComponentName): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
