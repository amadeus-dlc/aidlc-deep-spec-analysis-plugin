import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// findings 文書の finding.kind。閉集合11種と正準順位を所有する。
// 未知の種類は生成時に拒否し、正常な判定として復元しない。

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

export class FindingKind {
  readonly #value: string;

  private constructor(raw: string) {
    if (!Object.hasOwn(KIND_RANK, raw)) throw new IllegalArgumentException({ kind: "unknown-finding-kind", raw });
    this.#value = raw;
  }

  static of(raw: string): FindingKind {
    return new FindingKind(raw);
  }

  static parse(raw: string): Result<FindingKind, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new FindingKind(raw));
  }

  // 閉集合 11 種の名前付きファクトリ（値オブジェクト自身の生成口）。domain／
  // usecase が自ら選ぶ kind は文字列を経由せずこの口から得る——正常生成経路に
  // 任意の string が入る余地を型で断つ（FR3.2、種別規律 3-2）。
  static conflict(): FindingKind {
    return FindingKind.of("conflict");
  }

  static completenessGap(): FindingKind {
    return FindingKind.of("completeness-gap");
  }

  static scenarioViolation(): FindingKind {
    return FindingKind.of("scenario-violation");
  }

  static unreachable(): FindingKind {
    return FindingKind.of("unreachable");
  }

  static redundancy(): FindingKind {
    return FindingKind.of("redundancy");
  }

  static refinementViolation(): FindingKind {
    return FindingKind.of("refinement-violation");
  }

  static mappingGap(): FindingKind {
    return FindingKind.of("mapping-gap");
  }

  static structureInvalid(): FindingKind {
    return FindingKind.of("structure-invalid");
  }

  static referenceBroken(): FindingKind {
    return FindingKind.of("reference-broken");
  }

  static consistencyMismatch(): FindingKind {
    return FindingKind.of("consistency-mismatch");
  }

  static crossCheckDisagreement(): FindingKind {
    return FindingKind.of("cross-check-disagreement");
  }

  // 文書の正準順位（kind 順位表）。
  static canonicalOrder(): readonly string[] {
    return Object.keys(KIND_RANK);
  }

  equals(other: FindingKind): boolean {
    return this.#value === other.#value;
  }

  compareTo(other: FindingKind): number {
    return KIND_RANK[this.#value] - KIND_RANK[other.#value];
  }

  isConflict(): boolean {
    return this.#value === "conflict";
  }

  asString(): string {
    return this.#value;
  }
}
