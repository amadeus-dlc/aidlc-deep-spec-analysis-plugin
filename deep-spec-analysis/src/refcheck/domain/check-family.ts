// CheckFamily — 検査ファミリー識別子（DD-0 / CD-1 / FD-E1 / XS-1 …）の
// ドメインプリミティブ。レポートの描画規約はファミリー自身の知識：finding detail
// の `${family}: ${detail}` prefix と checked/skip target の `check:${family}`
// はどちらも golden バイト凍結の文言面で、ここ以外では組み立てない。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

type CheckFamilyError = { readonly kind: "empty-family"; readonly raw: string };

export class CheckFamily {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<CheckFamily, CheckFamilyError> {
    if (raw === "") return err({ kind: "empty-family", raw });
    return ok(new CheckFamily(raw));
  }

  static reconstitute(raw: string): CheckFamily {
    return new CheckFamily(raw);
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

