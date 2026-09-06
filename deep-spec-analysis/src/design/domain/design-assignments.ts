import type { FirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { type AttributePath, type Expression, KeyedIndex } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAssignment } from "./design-assignment.ts";

/** 設計イベントの属性代入。右辺式だけを問い合わせる索引。 */
export class DesignAssignments implements FirstClassCollection {
  readonly #values: KeyedIndex<AttributePath, DesignAssignment>;

  private constructor(values: readonly DesignAssignment[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "expression-too-large" });
    let nodes = 0;
    const entries: (readonly [AttributePath, DesignAssignment])[] = [];
    for (const assignment of values) {
      assignment.rightHandSide().walk(() => {
        if (++nodes > 10_000) throw new IllegalArgumentException({ kind: "expression-too-large" });
      });
      entries.push([assignment.target(), assignment]);
    }
    this.#values = KeyedIndex.of(entries);
  }

  static parse(values: readonly DesignAssignment[]): Result<DesignAssignments, ParseError> {
    return parseConstruction(() => new DesignAssignments(values));
  }

  static of(values: readonly DesignAssignment[]): DesignAssignments {
    return new DesignAssignments(values);
  }

  rhsOf(path: AttributePath): Expression | undefined {
    return this.#values.get(path)?.rightHandSide().asExpression();
  }

  isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
