import { err, ok } from "../../kernel/infrastructure/index.ts";
import type { Result } from "../../kernel/infrastructure/index.ts";
import { EntityName } from "./entity-name.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

// FD-E6 の参照先トークン（"Entity" / "Entity.attribute" / 自由文）。
export class ReferenceTarget {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<ReferenceTarget, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new ReferenceTarget(raw));
  }
  static reconstitute(raw: string): ReferenceTarget { return new ReferenceTarget(raw); }
  equals(other: ReferenceTarget): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // FD-E6: Entity / Entity.attr 形の構文知識は参照自身が所有（凍結正規表現・属性部は非捕捉）。
  entityToken(): string | null {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
    return token ? (token[1] ?? null) : null;
  }
  // 自由文の緩い照合（小文字包含——凍結挙動）。
  looselyMentions(name: EntityName): boolean {
    return this.#value.toLowerCase().includes(name.asString().toLowerCase());
  }
}
