import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

const CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);

export class RuleCategory {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): RuleCategory {
    return new RuleCategory(raw);
  }

  static parse(raw: string): Result<RuleCategory, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new RuleCategory(raw));
  }
  equals(other: RuleCategory): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  normalized(): string { return this.#value.toLowerCase(); }
  isKnownCategory(): boolean { return CATEGORIES.has(this.normalized()); }
}
