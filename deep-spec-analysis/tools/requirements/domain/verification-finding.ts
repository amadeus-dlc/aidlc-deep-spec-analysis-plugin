// v1 検証 finding / skip の語彙（契約2）。witness は型付きユニオン——
// unsat core のラベル列・decode 済み状態モデル・クロスチェック判定表・
// 状態機械のステップトレース。

import { idCompare } from "../../kernel/domain/index.ts";
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


// v1 バックエンドの kind 順位表（4 kind・未知は 9）と正準ソート。
// 拡張 11-kind 表とは意図的に別実装のまま保つ（統一しない——バイト安全優先。
// 順序互換は tests/kind-rank.test.ts が機械証明）。旧
// verification-finding-order.ts から吸収し、コレクションだけが使う。
const KIND_RANK: { [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  "cross-check-disagreement": 3,
};

function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 9;
}

function sortVerificationFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  return [...findings].sort((a, b) => {
    const kr = rankOf(a.kind) - rankOf(b.kind);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

// finding / skip のファーストクラスコレクション。契約2 の正準ソート
// （kind 順位→targets→detail、target→reason）という集合の知識を所有する。


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
