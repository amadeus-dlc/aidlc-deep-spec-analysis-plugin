// 設計検証 finding / skip の語彙（契約2 拡張——unit 帰属つき）。witness は
// v1 判定から remap で受け継ぐ素通し値（core は remap 済みラベル列、trace /
// model / verdicts はそのまま）。

import type { DesignValue } from "./design-value.ts";

export interface DesignFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: DesignValue;
  unit: string;
  detail: string;
}

export interface DesignSkipped {
  target: string;
  reason: string;
  unit: string;
  detail?: string;
}

// finding / skip のファーストクラスコレクション。契約2 拡張（設計 11-kind
// 順位）の正準ソートという集合の知識を所有する。順位表は
// design-finding-order.ts の凍結実装を用いる。

import { sortDesignFindings, sortDesignSkipped } from "./design-finding-order.ts";

export class DesignFindings {
  readonly #values: readonly DesignFinding[];

  private constructor(values: readonly DesignFinding[]) {
    this.#values = values;
  }

  static of(values: readonly DesignFinding[]): DesignFindings {
    return new DesignFindings([...values]);
  }

  add(value: DesignFinding): DesignFindings {
    return new DesignFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignFinding> {
    yield* this.#values;
  }

  sortedCanonically(): DesignFindings {
    return new DesignFindings(sortDesignFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly DesignFinding[] {
    return this.#values;
  }
}

export class DesignSkips {
  readonly #values: readonly DesignSkipped[];

  private constructor(values: readonly DesignSkipped[]) {
    this.#values = values;
  }

  static of(values: readonly DesignSkipped[]): DesignSkips {
    return new DesignSkips([...values]);
  }

  add(value: DesignSkipped): DesignSkips {
    return new DesignSkips([...this.#values, value]);
  }

  concat(other: DesignSkips): DesignSkips {
    return new DesignSkips([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<DesignSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): DesignSkips {
    return new DesignSkips(sortDesignSkipped(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly DesignSkipped[] {
    return this.#values;
  }
}
