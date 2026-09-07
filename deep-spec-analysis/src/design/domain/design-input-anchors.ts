import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
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

  override map(transform: (element: DesignInputAnchor) => DesignInputAnchor): DesignInputAnchors {
    return this.mapTo(transform, DesignInputAnchors.of);
  }

  override combine(other: DesignInputAnchors): DesignInputAnchors {
    return this.combineTo(other, DesignInputAnchors.of);
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

  // 境界: 描画専用。ContentHash はここで asString() へ落ちる（キー順は旧挿入順）。
  toDocuments(): Json[] {
    return this.#values.map((anchor) => ({ artifact: anchor.artifact(), sha256: anchor.sha256().asString() }));
  }

  toArray(): readonly DesignInputAnchor[] {
    return this.#values;
  }
}
