import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 設計文書のエンティティ名。コンストラクタが非空条件を保証する。

import { NormalizedName } from "@deep-spec/kernel-domain";

export class EntityName {
  readonly #value: string;
  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "entity-name-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): EntityName {
    return new EntityName(raw);
  }

  static parse(raw: string): Result<EntityName, ParseError> {
    return parseConstruction(() => new EntityName(raw));
  }
  equals(other: EntityName): boolean { return this.#value === other.#value; }
  // 境界: 文言・witness 位置に逐語で載る宣言名。
  asString(): string { return this.#value; }
  // 照合はケース・区切りを畳んだ正規化名で行う（XS/FD-S の凍結挙動）。
  normalized(): NormalizedName { return NormalizedName.of(this.#value); }
}

