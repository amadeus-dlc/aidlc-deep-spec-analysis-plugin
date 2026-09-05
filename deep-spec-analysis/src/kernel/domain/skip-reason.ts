import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// 検証を省略した理由。findings スキーマの閉集合9値を生成時に保証する。
// 業務が選ぶ理由には名前付きファクトリを使う。

const KNOWN_REASONS: ReadonlySet<string> = new Set([
  "unavailable",
  "timeout",
  "capability",
  "compile-error",
  "waived",
  "absent-input",
  "stale-input",
  "ir-version-mismatch",
  "unrecognized-format",
]);

export class SkipReason {
  readonly #value: string;

  /** 閉集合で最長の unrecognized-format の文字数。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 19) throw new IllegalArgumentException({ kind: "skip-reason-too-long", raw: raw.length });
    if (!KNOWN_REASONS.has(raw)) throw new IllegalArgumentException({ kind: "unknown-skip-reason", raw });
    this.#value = raw;
  }

  static of(raw: string): SkipReason {
    return new SkipReason(raw);
  }

  static parse(raw: string): Result<SkipReason, ParseError> {
    return parseConstruction(() => new SkipReason(raw));
  }

  // 閉集合 9 値の名前付きファクトリ（値オブジェクト自身の生成口）。
  static unavailable(): SkipReason {
    return SkipReason.of("unavailable");
  }

  static timeout(): SkipReason {
    return SkipReason.of("timeout");
  }

  static capability(): SkipReason {
    return SkipReason.of("capability");
  }

  static compileError(): SkipReason {
    return SkipReason.of("compile-error");
  }

  static waived(): SkipReason {
    return SkipReason.of("waived");
  }

  static absentInput(): SkipReason {
    return SkipReason.of("absent-input");
  }

  static staleInput(): SkipReason {
    return SkipReason.of("stale-input");
  }

  static irVersionMismatch(): SkipReason {
    return SkipReason.of("ir-version-mismatch");
  }

  static unrecognizedFormat(): SkipReason {
    return SkipReason.of("unrecognized-format");
  }

  asString(): string {
    return this.#value;
  }

  // DesignSkipped.compareTo が守ってきた並び（reason の辞書順）と同じ。
  compareTo(other: SkipReason): number {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
}
