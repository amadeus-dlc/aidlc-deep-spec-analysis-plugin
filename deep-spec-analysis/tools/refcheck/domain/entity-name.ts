// functional-design（entities.md / rules.md / functional-spec.md / components.md）
// の語彙ドメインプリミティブ。すべて parse（strict な境界構築口・材料のみの
// エラー）と reconstitute（凍結文書からの逐語再水和——refcheck の取り込みは
// 全経路これ。壊れた値は parse で拒否せず、検査が**報告**する）を持つ。
// 照合・描画の解釈（正規化・整形）は語彙自身が所有し、検査は意味論だけを書く。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { Names } from "../../kernel/domain/index.ts";

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class EntityName {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<EntityName, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new EntityName(raw));
  }
  static reconstitute(raw: string): EntityName { return new EntityName(raw); }
  equals(other: EntityName): boolean { return this.#value === other.#value; }
  // 境界: 文言・witness 位置に逐語で載る宣言名。
  asString(): string { return this.#value; }
  // 照合はケース・区切りを畳んだ正規化名で行う（XS/FD-S の凍結挙動）。
  normalized(): string { return Names.normalize(this.#value); }
}






















