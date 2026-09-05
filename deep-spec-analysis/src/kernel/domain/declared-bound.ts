import {AttributeBound} from "./attribute-bound.ts";
import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";

// 文書が宣言した境界値。安全な整数境界 AttributeBound とは区別し、
// 検査対象の値を検証済みとして扱わずに保持する。
export class DeclaredBound {
  readonly #value: number;

  private constructor(value: Parameters<typeof DeclaredBound.of>[0]) { this.#value = value; }

  static of(value: number): DeclaredBound { return new DeclaredBound(value); }

  // 不適合な数値の宣言も診断対象として有効。解析成功と安全な境界値への適合は区別する。
  static parse(value: number): Result<DeclaredBound, ParseError> { return parseConstruction(() => new DeclaredBound(value)); }

  asNumber(): number { return this.#value; }

  isSafeInteger(): boolean { return AttributeBound.parse(this.#value).ok; }

  exceeds(other: DeclaredBound): boolean { return this.#value > other.#value; }
}
