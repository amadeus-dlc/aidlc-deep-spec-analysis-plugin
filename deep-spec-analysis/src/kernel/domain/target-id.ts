import { IllegalArgumentException, parseConstruction, type Result, compareCanonically } from "@deep-spec/kernel-infrastructure";
// 検査対象 ID。生成時に findings スキーマの targetId 形式を保証する。
// 正準順序は言語基盤の比較器を使い、ID 以外のトークンを ID に包まない。

// deep-spec-findings-schema.json の definitions.targetId と同値。
const TARGET_ID_PATTERNS: readonly RegExp[] = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/,
];

export class TargetId {
  readonly #value: string;

  private constructor(raw: string) {
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw))) throw new IllegalArgumentException({ kind: "malformed-target-id", raw });
    this.#value = raw;
  }

  static of(raw: string): TargetId {
    return new TargetId(raw);
  }

  static parse(raw: string): Result<TargetId, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new TargetId(raw));
  }

  equals(other: TargetId): boolean {
    return this.#value === other.#value;
  }

  // 正準順序——skipped ソートと finding の targets 面（= golden バイト）を決める。
  compareTo(other: TargetId): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
