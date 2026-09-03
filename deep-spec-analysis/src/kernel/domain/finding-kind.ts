// FindingKind — findings 文書（契約2）の finding.kind のドメインプリミティブ
//（種別規律の裁定 3-2、2026-09-03）。閉集合 11 種と正準順位（文書の並び）を
// 所有する。parse は閉集合の門、reconstitute は逐語——書かれた文書の降格試験
// が未知の kind を運ぶため。未知の kind は既知のどれよりも後ろ（凍結挙動）。
// v1 バックエンド（smt／quint）が出す 4 種の相対順序はこの表と一致する
//（旧 kind-rank.test が機械証明していた必要条件）。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

const KIND_RANK: { readonly [k: string]: number } = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10,
};

// kind は任意文字列なので、素の index アクセスだと "toString" 等が prototype の
// 継承プロパティを拾い NaN 比較になる。所有プロパティのみで順位を引く。
function rankOf(kind: string): number {
  return Object.hasOwn(KIND_RANK, kind) ? (KIND_RANK[kind] as number) : 99;
}

type FindingKindError = { readonly kind: "unknown-finding-kind"; readonly raw: string };

export class FindingKind {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<FindingKind, FindingKindError> {
    if (!Object.hasOwn(KIND_RANK, raw)) return err({ kind: "unknown-finding-kind", raw });
    return ok(new FindingKind(raw));
  }

  static reconstitute(raw: string): FindingKind {
    return new FindingKind(raw);
  }

  // 文書の正準順位（kind 順位表）。
  static canonicalOrder(): readonly string[] {
    return Object.keys(KIND_RANK);
  }

  equals(other: FindingKind): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: FindingKind): number {
    return rankOf(this.#value) - rankOf(other.#value);
  }

  isConflict(): boolean {
    return this.#value === "conflict";
  }

  asString(): string {
    return this.#value;
  }
}
