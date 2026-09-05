import type { DesignInputAnchor } from "./design-input-anchor.ts";

// 入力成果物の錨のファーストクラスコレクション。artifact 名昇順の整列
// （compose の不変条件）を所有する。
export class DesignInputAnchors {
  readonly #values: readonly DesignInputAnchor[];

  private constructor(values: readonly DesignInputAnchor[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignInputAnchor[]): DesignInputAnchors {
    return new DesignInputAnchors(values);
  }

  add(value: DesignInputAnchor): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignInputAnchor> {
    yield* this.#values;
  }

  sortedByArtifact(): DesignInputAnchors {
    return new DesignInputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }

  toArray(): readonly DesignInputAnchor[] {
    return this.#values;
  }
}
