import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// CheckFamily — 検査ファミリー識別子（DD-0 / CD-1 / FD-E1 / XS-1 …）の
// ドメインプリミティブ。レポートの描画規約はファミリー自身の知識：finding detail
// の `${family}: ${detail}` prefix と checked/skip target の `check:${family}`
// はどちらも golden バイト凍結の文言面で、ここ以外では組み立てない。

export class CheckFamily {
  readonly #value: string;

  /** 識別名・ID・バージョンの処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128) throw new IllegalArgumentException({ kind: "check-family-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-family", raw });
    this.#value = raw;
  }

  static of(raw: string): CheckFamily {
    return new CheckFamily(raw);
  }

  static parse(raw: string): Result<CheckFamily, ParseError> {
    return parseConstruction(() => new CheckFamily(raw));
  }

  equals(other: CheckFamily): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // finding detail の凍結描画：`${family}: ${detail}`。
  prefixedDetail(detail: string): string {
    return `${this.#value}: ${detail}`;
  }

  // checked / skip target の凍結描画：`check:${family}`。
  asCheckTarget(): string {
    return `check:${this.#value}`;
  }
}
