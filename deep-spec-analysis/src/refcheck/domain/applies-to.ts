import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import { EntityName } from "./entity-name.ts";

export class AppliesTo {
  readonly #value: string;
  /** 対象指定文の処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "applies-to-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): AppliesTo {
    return new AppliesTo(raw);
  }

  static parse(raw: string): Result<AppliesTo, ParseError> {
    return parseConstruction(() => new AppliesTo(raw));
  }
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
