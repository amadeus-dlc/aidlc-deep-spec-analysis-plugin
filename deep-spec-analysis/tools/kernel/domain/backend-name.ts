// BackendName — 検証バックエンド名（smt / quint / cross-check / components …）
// のドメインプリミティブ。レポート id の派生名・crossChecked 判定表・比較表の
// キーとして全コンテキストが話す共有語彙。

import { type Result, err, ok } from "../infrastructure/index.ts";

type BackendNameError = { readonly kind: "empty-backend-name"; readonly raw: string };

export class BackendName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<BackendName, BackendNameError> {
    if (raw === "") return err({ kind: "empty-backend-name", raw });
    return ok(new BackendName(raw));
  }

  static reconstitute(raw: string): BackendName {
    return new BackendName(raw);
  }

  equals(other: BackendName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}
