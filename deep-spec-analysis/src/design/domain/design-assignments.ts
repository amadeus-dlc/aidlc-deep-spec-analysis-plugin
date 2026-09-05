import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
// DesignAssignments — 設計イベントの効果（属性パス → 右辺式）の索引。キーは
// AttributePath、内側は KeyedIndex（裁定 3-1、2026-09-03）。

import type { AttributePath, Expression } from "@deep-spec/kernel-domain";
import { KeyedIndex } from "@deep-spec/kernel-domain";

export class DesignAssignments {
  readonly #values: KeyedIndex<AttributePath, Expression>;

  private constructor(values: KeyedIndex<AttributePath, Expression>) {
    this.#values = KeyedIndex.of([...values].map(([path, expression]) => [path, ExpressionTree.of(expression).asExpression()] as const));
  }

  static parse(values: KeyedIndex<AttributePath, Expression>): Result<DesignAssignments, ParseError> {
    return parseConstruction(() => new DesignAssignments(values));
  }

  static of(values: KeyedIndex<AttributePath, Expression>): DesignAssignments {
    return new DesignAssignments(values);
  }

  rhsOf(path: AttributePath): Expression | undefined {
    return this.#values.get(path);
  }
}
