import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import {BusinessRuleIdentifier} from "./business-rule-identifier.ts";

// 文書が記述した規則IDの原文。正当な BusinessRuleIdentifier とは別の概念であり、
// 不正な記述も検査対象として保持する。検証を迂回して既知のIDを作らない。
export class DeclaredRuleIdentifier {
  readonly #value: string;

  /** 128 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 128) throw new IllegalArgumentException({ kind: "declared-rule-id-too-long", raw: value.length });
    this.#value = value; }

  static parse(value: string): Result<DeclaredRuleIdentifier, ParseError> {
    return parseConstruction(() => new DeclaredRuleIdentifier(value));
  }

  static of(value: string): DeclaredRuleIdentifier {
    return new DeclaredRuleIdentifier(value);
  }

  asString(): string { return this.#value; }

  matchesShape(): boolean { return BusinessRuleIdentifier.parse(this.#value).ok; }
}
