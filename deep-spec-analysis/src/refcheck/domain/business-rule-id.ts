import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class BusinessRuleId {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<BusinessRuleId, TokenError> {
    if (!/^BR[0-9]+\.[0-9]+$/.test(raw)) return err({ kind: "empty-token", raw });
    return ok(new BusinessRuleId(raw));
  }
  static reconstitute(raw: string): BusinessRuleId { return new BusinessRuleId(raw); }
  equals(other: BusinessRuleId): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // BR{group}.{seq} 形か（FD-R2 の判定と finding target の選別に使う）。
  matchesShape(): boolean { return /^BR[0-9]+\.[0-9]+$/.test(this.#value); }
}
