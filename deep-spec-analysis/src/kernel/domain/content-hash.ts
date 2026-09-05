import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// SHA-256 ダイジェスト。64 桁の小文字16進数という不変条件を
// コンストラクタに集約し、of / parse / ハッシュ計算の全経路で保証する。

import { createHash } from "node:crypto";

export class ContentHash {
  readonly #value: string;

  /**
   * サイズ→字句の順に検証する。SHA-256の小文字16進表記は64文字で、
   * 区切りや接頭辞を持たないため、この二条件で構文も成立する。
   * 値単体に追加の意味制約はない。特定の内容との一致や発生源の正当性は、
   * ダイジェスト文字列だけでは確認できず、内容との照合・取得境界で扱う。
   */
  private constructor(raw: string) {
    if (raw.length !== 64) throw new IllegalArgumentException({ kind: "not-a-sha256-hex", raw });
    if (/[^0-9a-f]/.test(raw)) throw new IllegalArgumentException({ kind: "not-a-sha256-hex", raw });
    this.#value = raw;
  }

  static of(raw: string): ContentHash {
    return new ContentHash(raw);
  }

  static parse(raw: string): Result<ContentHash, ParseError> {
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
