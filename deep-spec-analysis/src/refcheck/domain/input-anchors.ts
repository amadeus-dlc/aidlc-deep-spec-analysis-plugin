import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { InputAnchor } from "./input-anchor.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";

// inputs[] のファーストクラスコレクション。artifact 順の整列（irHash の
// 材料になる凍結正準形）という集合の知識を所有する。
export class InputAnchors
  extends FirstClassCollectionBase<InputAnchor, InputAnchors>
  implements FirstClassCollection<InputAnchor>
{
  readonly #values: readonly InputAnchor[];

  private constructor(values: readonly InputAnchor[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-input-anchors");
  }

  protected override rebuild(values: readonly InputAnchor[]): InputAnchors {
    return new InputAnchors(values);
  }

  override map(transform: (element: InputAnchor) => InputAnchor): InputAnchors {
    return this.mapTo(transform, InputAnchors.of);
  }

  override combine(other: InputAnchors): InputAnchors {
    return this.combineTo(other, InputAnchors.of);
  }

  static parse(values: readonly InputAnchor[]): Result<InputAnchors, ParseError> {
    return parseConstruction(() => new InputAnchors(values));
  }

  static of(values: readonly InputAnchor[]): InputAnchors {
    return new InputAnchors(values);
  }

  add(value: InputAnchor): InputAnchors {
    return new InputAnchors([...this.#values, value]);
  }

  addAll(values: Iterable<InputAnchor>): InputAnchors {
    return new InputAnchors([...this.#values, ...values]);
  }

  override *[Symbol.iterator](): Iterator<InputAnchor> {
    yield* this.#values;
  }

  sortedByArtifact(): InputAnchors {
    return new InputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }

  // 錨すべてを保持順のままレポートへ記録する。
  recordIn(report: ReferenceCheckReport): void {
    for (const anchor of this.#values) report.input(anchor);
  }

  // 境界: 描画専用。inputs[] は保持順（sortedByArtifact 済みの凍結正準形）。
  toDocuments(): Json[] {
    return this.#values.map((anchor) => anchor.toDocument());
  }

  toArray(): readonly InputAnchor[] {
    return this.#values;
  }
}
