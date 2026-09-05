import { TargetIdentifier } from "@deep-spec/kernel-domain";
import type { ParseError } from "@deep-spec/kernel-infrastructure";
import {
  compareCanonically,
  IllegalArgumentException,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

export class ObligationIdentifier {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "obligation-id-too-long", raw: raw.length });
    if (!/^OB-[0-9]+$/.test(raw)) throw new IllegalArgumentException({ kind: "malformed-obligation-id", raw });
    this.#value = raw;
  }

  static of(raw: string): ObligationIdentifier {
    return new ObligationIdentifier(raw);
  }

  static parse(raw: string): Result<ObligationIdentifier, ParseError> {
    return parseConstruction(() => new ObligationIdentifier(raw));
  }

  equals(other: ObligationIdentifier): boolean {
    return this.#value === other.#value;
  }

  // 正準順（英字骨格→数値セグメント）は共通の比較器で求める。
  compareTo(other: ObligationIdentifier): number {
    return compareCanonically(this.#value, other.#value);
  }

  asString(): string {
    return this.#value;
  }

  // 義務 id は検査対象 id でもある（finding の targets / skip の target 面）。
  asTargetId(): TargetIdentifier {
    return TargetIdentifier.of(this.#value);
  }
}
