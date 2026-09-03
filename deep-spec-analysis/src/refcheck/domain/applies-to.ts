import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";
import { EntityName } from "./entity-name.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class AppliesTo {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<AppliesTo, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new AppliesTo(raw));
  }
  static reconstitute(raw: string): AppliesTo { return new AppliesTo(raw); }
  equals(other: AppliesTo): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // FD-R4: Entity / Entity.attribute 形の構文知識は参照自身が所有（凍結正規表現）。
  entityToken(): string | null {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    return token ? (token[1] ?? null) : null;
  }
  attributeToken(): string | null {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    return token?.[2] ?? null;
  }
  // 自由文の緩い照合（小文字包含——凍結挙動）。
  looselyMentions(name: EntityName): boolean {
    return this.#value.toLowerCase().includes(name.asString().toLowerCase());
  }
}
