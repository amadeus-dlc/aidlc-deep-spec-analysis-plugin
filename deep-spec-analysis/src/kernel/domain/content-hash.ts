import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// SHA-256 ダイジェスト。64 桁の小文字16進数という不変条件を
// コンストラクタに集約し、of / parse / ハッシュ計算の全経路で保証する。

import { createHash } from "node:crypto";

export class ContentHash {
  readonly #value: string;

  private constructor(raw: string) {
    if (!/^[0-9a-f]{64}$/.test(raw)) throw new IllegalArgumentException({ kind: "not-a-sha256-hex", raw });
    this.#value = raw;
  }

  static of(raw: string): ContentHash {
    return new ContentHash(raw);
  }

  static parse(raw: string): Result<ContentHash, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ContentHash(raw));
  }

  static ofText(text: string): ContentHash {
    return new ContentHash(createHash("sha256").update(text, "utf-8").digest("hex"));
  }

  static ofBytes(bytes: Uint8Array): ContentHash {
    return new ContentHash(createHash("sha256").update(bytes).digest("hex"));
  }

  equals(other: ContentHash): boolean {
    return this.#value === other.#value;
  }

  // 境界: 文書へ逐語で載る値。
  asString(): string {
    return this.#value;
  }
}
