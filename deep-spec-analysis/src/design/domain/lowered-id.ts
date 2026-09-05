import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// lowered 採番 id(OB-n / SC-n / BG-n)——v1 子文書のバイト面に載る識別。
export class LoweredId {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "lowered-id-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    this.#value = raw;
  }

  static of(raw: string): LoweredId {
    return new LoweredId(raw);
  }

  static parse(raw: string): Result<LoweredId, ParseError> {
    return parseConstruction(() => new LoweredId(raw));
  }

  equals(other: LoweredId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
