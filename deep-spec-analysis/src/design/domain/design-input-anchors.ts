import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignInputAnchor } from "./design-input-anchor.ts";

// 入力成果物の錨のファーストクラスコレクション。artifact 名昇順の整列
// （compose の不変条件）を所有する。
export class DesignInputAnchors extends FirstClassCollectionBase<DesignInputAnchor, DesignInputAnchors> {
  readonly #values: readonly DesignInputAnchor[];

  private constructor(values: readonly DesignInputAnchor[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-input-anchors");
  }

  protected override rebuild(values: readonly DesignInputAnchor[]): DesignInputAnchors {
    return new DesignInputAnchors(values);
  }

  static of(values: readonly DesignInputAnchor[]): DesignInputAnchors {
    return new DesignInputAnchors(values);
  }

  static parse(values: readonly DesignInputAnchor[]): Result<DesignInputAnchors, ParseError> {
    return parseConstruction(() => new DesignInputAnchors(values));
  }

  add(value: DesignInputAnchor): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignInputAnchor> {
    yield* this.#values;
  }

  sortedByArtifact(): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }

  toArray(): readonly DesignInputAnchor[] {
    return this.#values;
  }
}
