import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignTransition } from "./design-transition.ts";

// 遷移のファーストクラスコレクション。id の正準順（lowering の凍結順）を所有。
export class DesignTransitions extends FirstClassCollectionBase<DesignTransition, DesignTransitions> {
  readonly #values: readonly DesignTransition[];

  private constructor(values: readonly DesignTransition[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-transitions");
  }

  protected rebuild(values: readonly DesignTransition[]): DesignTransitions {
    return new DesignTransitions(values);
  }

  static of(values: readonly DesignTransition[]): DesignTransitions {
    return new DesignTransitions(values);
  }

  static parse(values: readonly DesignTransition[]): Result<DesignTransitions, ParseError> {
    return parseConstruction(() => new DesignTransitions(values));
  }

  add(value: DesignTransition): DesignTransitions {
    return new DesignTransitions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransition> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((t) => t.id().asString());
  }

  sortedCanonically(): DesignTransitions {
    return new DesignTransitions([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  toArray(): readonly DesignTransition[] {
    return this.#values;
  }
}
