// VerificationMethod — findings 文書（契約2）の method（exhaustive / bounded /
// simulation / static）のドメインプリミティブ（種別規律の裁定 3-2、2026-09-03）。
// 値はバックエンドが決め、文書へは asString で降りる。parse は閉集合の門、
// reconstitute は逐語——adapter の寛容な hydration 用（書かれた文書の降格試験が
// 未知の method を運びうるため）。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";

const KNOWN_METHODS: ReadonlySet<string> = new Set(["exhaustive", "bounded", "simulation", "static"]);

type VerificationMethodError = { readonly kind: "unknown-verification-method"; readonly raw: string };

export class VerificationMethod {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<VerificationMethod, VerificationMethodError> {
    if (!KNOWN_METHODS.has(raw)) return err({ kind: "unknown-verification-method", raw });
    return ok(new VerificationMethod(raw));
  }

  static reconstitute(raw: string): VerificationMethod {
    return new VerificationMethod(raw);
  }

  equals(other: VerificationMethod): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
