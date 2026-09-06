import type { ParseError, Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { FirstClassCollectionFactory } from "./first-class-collection-factory.ts";

export interface FallibleFirstClassCollectionFactory<Arguments extends readonly unknown[], Collection extends object>
  extends FirstClassCollectionFactory<Arguments, Collection> {
  parse(...args: Arguments): Result<Collection, ParseError>;
}
