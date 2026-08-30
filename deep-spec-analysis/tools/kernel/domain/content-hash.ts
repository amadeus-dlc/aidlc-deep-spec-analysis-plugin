// ContentHash — sha256 hex ダイジェストの語彙（64 桁小文字 16 進）。
// parse が strict な構築口（境界の検証）、reconstitute は凍結文書からの
// 逐語再水和専用——集約の compose/reconstitute と同じ二面性で、寛容読みの
// 責務はアダプタに残る。ContentHash.ofText() は常に正な値を生むため直接構築する
// （型ごとの new は 1 箇所：private constructor のみ）。

import { createHash } from "node:crypto";
import { type Result, err, ok } from "../infrastructure/index.ts";

export type ContentHashError = { readonly kind: "not-a-sha256-hex"; readonly raw: string };

export class ContentHash {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ContentHash, ContentHashError> {
    if (!/^[0-9a-f]{64}$/.test(raw)) return err({ kind: "not-a-sha256-hex", raw });
    return ok(new ContentHash(raw));
  }

  // 凍結文書の逐語再水和専用（不正値も文書の bytes として保存する）。
  static reconstitute(raw: string): ContentHash {
    return new ContentHash(raw);
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
  value(): string {
    return this.#value;
  }
}
