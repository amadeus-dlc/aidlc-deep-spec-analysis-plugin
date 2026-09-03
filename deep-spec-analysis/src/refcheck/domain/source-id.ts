import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

// rules.md の source 欄から抽出された FR/NFR 参照。
export class SourceId {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<SourceId, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new SourceId(raw));
  }
  static reconstitute(raw: string): SourceId { return new SourceId(raw); }
  equals(other: SourceId): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
