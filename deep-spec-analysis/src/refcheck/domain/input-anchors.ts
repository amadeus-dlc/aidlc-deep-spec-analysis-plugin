import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { InputAnchor } from "./input-anchor.ts";

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

  toArray(): readonly InputAnchor[] {
    return this.#values;
  }
}
