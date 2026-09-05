import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// rules.md の source 欄から抽出された FR/NFR 参照。
export class SourceId {
  readonly #value: string;
  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "source-id-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): SourceId {
    return new SourceId(raw);
  }

  static parse(raw: string): Result<SourceId, ParseError> {
    return parseConstruction(() => new SourceId(raw));
  }
  equals(other: SourceId): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
}
