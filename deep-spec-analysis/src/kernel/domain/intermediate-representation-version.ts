import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 契約 IR のバージョン。major.minor.patch の形式を生成時に保証する。
// 既存 IR の互換性のため先行ゼロを許す。major の解釈もこの値が所有する。

export class IntermediateRepresentationVersion {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "ir-version-too-long", raw: raw.length });
    if (!/^\d+\.\d+\.\d+$/.test(raw)) throw new IllegalArgumentException({ kind: "not-a-semver", raw });
    this.#value = raw;
  }

  static of(raw: string): IntermediateRepresentationVersion {
    return new IntermediateRepresentationVersion(raw);
  }

  static parse(raw: string): Result<IntermediateRepresentationVersion, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationVersion(raw));
  }

  equals(other: IntermediateRepresentationVersion): boolean {
    return this.#value === other.#value;
  }

  // 境界: 旧実装の major 抽出と同じ計算（verdict 文言に載る）。
  majorVersion(): number {
    return Number.parseInt(this.#value.split(".")[0] ?? "", 10);
  }

  supportsMajor(major: number): boolean {
    return this.majorVersion() === major;
  }

  // 境界: 文書・文言へ逐語で載る値。
  asString(): string {
    return this.#value;
  }
}
