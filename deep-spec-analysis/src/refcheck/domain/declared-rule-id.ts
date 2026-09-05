import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import {BusinessRuleId} from "./business-rule-id.ts";

// 文書が記述した規則IDの原文。正当な BusinessRuleId とは別の概念であり、
// 不正な記述も検査対象として保持する。検証を迂回して既知のIDを作らない。
export class DeclaredRuleId {
  readonly #value: string;

  /** 128 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 128) throw new IllegalArgumentException({ kind: "declared-rule-id-too-long", raw: value.length });
    this.#value = value; }

  static parse(value: string): Result<DeclaredRuleId, ParseError> { return parseConstruction(() => new DeclaredRuleId(value)); }

  static of(value: string): DeclaredRuleId { return new DeclaredRuleId(value); }

  asString(): string { return this.#value; }

  matchesShape(): boolean { return BusinessRuleId.parse(this.#value).ok; }
}
