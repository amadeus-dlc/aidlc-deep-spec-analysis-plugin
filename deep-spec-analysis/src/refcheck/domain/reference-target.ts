import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import type { EntityName } from "./entity-name.ts";

// FD-E6 の参照先トークン（"Entity" / "Entity.attribute" / 自由文）。
export class ReferenceTarget {
  readonly #value: string;
  /** 自由文も含む参照宣言の処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "reference-target-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): ReferenceTarget {
    return new ReferenceTarget(raw);
  }

  static parse(raw: string): Result<ReferenceTarget, ParseError> {
    return parseConstruction(() => new ReferenceTarget(raw));
  }
  equals(other: ReferenceTarget): boolean {
    return this.#value === other.#value;
  }
  asString(): string {
    return this.#value;
  }
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
