import type { ParseError } from "@deep-spec/kernel-infrastructure";
import {
  compareCanonically,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

// 検査対象 ID。生成時に findings スキーマの targetId 形式を保証する。
// 正準順序は言語基盤の比較器を使い、ID 以外のトークンを ID に包まない。

// deep-spec-findings-schema.json の definitions.targetId と同値。
const TARGET_ID_PATTERNS: readonly RegExp[] = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/,
];

export class TargetIdentifier {
  readonly #value: string;

  /** 複合の検査対象ID。名前・属性パスと種別接頭辞を収める上限。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 1024) throw new IllegalArgumentException({ kind: "target-id-too-long", raw: raw.length });
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw)))
      throw new IllegalArgumentException({ kind: "malformed-target-id", raw });
    this.#value = raw;
  }

  static of(raw: string): TargetIdentifier {
    return new TargetIdentifier(raw);
  }

  static parse(raw: string): Result<TargetIdentifier, ParseError> {
    return parseConstruction(() => new TargetIdentifier(raw));
  }

  equals(other: TargetIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順序——skipped ソートと finding の targets 面（= golden バイト）を決める。
  compareTo(other: TargetIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }
}
