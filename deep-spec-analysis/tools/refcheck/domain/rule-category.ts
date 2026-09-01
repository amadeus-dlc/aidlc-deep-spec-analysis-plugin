import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";

const CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class RuleCategory {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<RuleCategory, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new RuleCategory(raw));
  }
  static reconstitute(raw: string): RuleCategory { return new RuleCategory(raw); }
  equals(other: RuleCategory): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): string { return this.#value.toLowerCase(); }
  isKnownCategory(): boolean { return CATEGORIES.has(this.normalized()); }
}
