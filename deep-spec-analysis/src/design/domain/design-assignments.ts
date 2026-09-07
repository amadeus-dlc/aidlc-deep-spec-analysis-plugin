import {
  type AttributePath,
  type Expression,
  FirstClassCollectionBase,
  KeyedIndex,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAssignment } from "./design-assignment.ts";

/** 設計イベントの属性代入。右辺式だけを問い合わせる索引。 */
export class DesignAssignments extends FirstClassCollectionBase<DesignAssignment, DesignAssignments> {
  readonly #values: KeyedIndex<AttributePath, DesignAssignment>;

  private constructor(values: readonly DesignAssignment[]) {
    super();
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

  protected override rebuild(values: readonly DesignAssignment[]): DesignAssignments {
    return new DesignAssignments(values);
  }

  override *[Symbol.iterator](): Iterator<DesignAssignment> {
    yield* this.#values.values();
  }

  override map(transform: (element: DesignAssignment) => DesignAssignment): DesignAssignments {
    return this.mapTo(transform, DesignAssignments.of);
  }

  override combine(other: DesignAssignments): DesignAssignments {
    return this.combineTo(other, DesignAssignments.of);
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
}
