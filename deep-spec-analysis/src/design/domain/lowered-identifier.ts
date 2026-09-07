import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import {
  hashOfString,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

// lowered 採番 id(OB-n / SC-n / BG-n)——v1 子文書のバイト面に載る識別。
export class LoweredIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "lowered-id-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    if (!/^(OB|SC|BG)-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "invalid-lowered-identifier", raw });
    this.#value = raw;
  }

  static of(raw: string): LoweredIdentifier {
    return new LoweredIdentifier(raw);
  }

  static parse(raw: string): Result<LoweredIdentifier, ParseError> {
    return parseConstruction(() => new LoweredIdentifier(raw));
  }

  belongsTo(namespace: "OB" | "SC" | "BG"): boolean {
    return this.#value.startsWith(`${namespace}-`);
  }

  equals(other: LoweredIdentifier): boolean {
    return this.#value === other.#value;
  }

  hashCode(): number {
    return hashOfString(this.#value);
  }

  asString(): string {
    return this.#value;
  }
}
