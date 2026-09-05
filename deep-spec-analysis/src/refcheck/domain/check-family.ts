import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// CheckFamily — 検査ファミリー識別子（DD-0 / CD-1 / FD-E1 / XS-1 …）の
// ドメインプリミティブ。レポートの描画規約はファミリー自身の知識：finding detail
// の `${family}: ${detail}` prefix と checked/skip target の `check:${family}`
// はどちらも golden バイト凍結の文言面で、ここ以外では組み立てない。

export class CheckFamily {
  readonly #value: string;

  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-family", raw });
    this.#value = raw;
  }

  static of(raw: string): CheckFamily {
    return new CheckFamily(raw);
  }

  static parse(raw: string): Result<CheckFamily, IllegalArgumentException["problem"]> {
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

