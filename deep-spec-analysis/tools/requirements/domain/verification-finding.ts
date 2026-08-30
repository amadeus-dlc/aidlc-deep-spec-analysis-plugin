// v1 検証 finding / skip の語彙（契約2）。witness は型付きユニオン——
// unsat core のラベル列・decode 済み状態モデル・クロスチェック判定表・
// 状態機械のステップトレース。

import type { TraceState } from "./trace-state.ts";

export type VerificationWitness =
  | { readonly core: string[] }
  | { readonly model: { [path: string]: boolean | number | string } }
  | { readonly verdicts: { [backend: string]: "violated" | "clean" } }
  | { readonly trace: TraceState[] };

export interface VerificationFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: VerificationWitness;
  detail: string;
}

export interface VerificationSkipped {
  target: string;
  reason: string;
  detail?: string;
}

// finding / skip のファーストクラスコレクション。契約2 の正準ソート
// （kind 順位→targets→detail、target→reason）という集合の知識を所有する。
// 順位表は verification-finding-order.ts の凍結実装を用いる。

import { sortVerificationFindings, sortVerificationSkipped } from "./verification-finding-order.ts";

export class VerificationFindings {
  readonly #values: readonly VerificationFinding[];

  private constructor(values: readonly VerificationFinding[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings([...values]);
  }

  add(value: VerificationFinding): VerificationFindings {
    return new VerificationFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<VerificationFinding> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationFindings {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly VerificationFinding[] {
    return this.#values;
  }
}

export class VerificationSkips {
  readonly #values: readonly VerificationSkipped[];

  private constructor(values: readonly VerificationSkipped[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips([...values]);
  }

  add(value: VerificationSkipped): VerificationSkips {
    return new VerificationSkips([...this.#values, value]);
  }

  concat(other: VerificationSkips): VerificationSkips {
    return new VerificationSkips([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<VerificationSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationSkips {
    return new VerificationSkips(sortVerificationSkipped(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly VerificationSkipped[] {
    return this.#values;
  }
}
