// InputAnchor — 入力成果物の錨。検査が「どの入力成果物のどのバイト列に
// 基づいたか」の宣言で、文書の inputs[] に逐語で載り（irHash の材料）、
// 下流の陳腐化検出の根拠になる。requirements の SourceAnchor と同じ
// 「内容による錨着」の語彙（旧名 InputEntry — 台帳行という技術語だった）。

import type { ContentHash } from "../../kernel/domain/index.ts";

export interface InputAnchor {
  artifact: string;
  sha256: ContentHash;
}

// inputs[] のファーストクラスコレクション。artifact 順の整列（irHash の
// 材料になる凍結正準形）という集合の知識を所有する。
export class InputAnchors {
  readonly #values: readonly InputAnchor[];

  private constructor(values: readonly InputAnchor[]) {
    this.#values = values;
  }

  static of(values: readonly InputAnchor[]): InputAnchors {
    return new InputAnchors([...values]);
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
    return new InputAnchors([...this.#values].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0)));
  }

  toArray(): readonly InputAnchor[] {
    return this.#values;
  }
}
