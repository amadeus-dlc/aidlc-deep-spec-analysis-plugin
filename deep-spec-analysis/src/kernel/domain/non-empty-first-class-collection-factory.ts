import type { ParseError, Result } from "@deep-spec-analysis/kernel-infrastructure";

/** 非空は必須のheadで表す。インスタンスに空判定を要求しない。 */
export interface NonEmptyFirstClassCollectionFactory<Element extends object, Collection extends object> {
  of(head: Element, tail: readonly Element[]): Collection;
  parse(head: Element, tail: readonly Element[]): Result<Collection, ParseError>;
}
