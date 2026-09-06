import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { InputAnchor } from "./input-anchor.ts";

// inputs[] のファーストクラスコレクション。artifact 順の整列（irHash の
// 材料になる凍結正準形）という集合の知識を所有する。
export class InputAnchors implements FirstClassCollection, IterableFirstClassCollection<InputAnchor> {
  readonly #values: readonly InputAnchor[];

  private constructor(values: readonly InputAnchor[]) {
    this.#values = Object.freeze([...values]);
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

  *[Symbol.iterator](): Iterator<InputAnchor> {
    yield* this.#values;
  }

  sortedByArtifact(): InputAnchors {
    return new InputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }

  toArray(): readonly InputAnchor[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
