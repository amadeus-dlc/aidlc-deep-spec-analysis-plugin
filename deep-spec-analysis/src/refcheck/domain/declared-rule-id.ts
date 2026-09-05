import {BusinessRuleId} from "./business-rule-id.ts";

// 文書が記述した規則IDの原文。正当な BusinessRuleId とは別の概念であり、
// 不正な記述も検査対象として保持する。検証を迂回して既知のIDを作らない。
export class DeclaredRuleId {
  readonly #value: string;

  private constructor(value: Parameters<typeof DeclaredRuleId.of>[0]) { this.#value = value; }

  static of(value: string): DeclaredRuleId { return new DeclaredRuleId(value); }

  asString(): string { return this.#value; }

  matchesShape(): boolean { return BusinessRuleId.parse(this.#value).ok; }
}
