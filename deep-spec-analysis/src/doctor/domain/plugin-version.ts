import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// 配布プラグインの stable Semantic Version。Git tag の任意の `v` 接頭辞を
// 入口で正規化し、比較判断を値オブジェクト自身に閉じる。
export class PluginVersion {
  readonly #major: bigint;
  readonly #minor: bigint;
  readonly #patch: bigint;

  /** バージョン本体128コード単位と任意のv接頭辞1文字。asTagの出力も再解析できる。 */
  private constructor(raw: string) {
    if (raw.length > 129 || (raw.length === 129 && raw[0] !== "v"))
      throw new IllegalArgumentException({ kind: "plugin-version-too-long", raw: raw.length });
    const match = raw.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    const major = match?.[1];
    const minor = match?.[2];
    const patch = match?.[3];
    if (major === undefined || minor === undefined || patch === undefined)
      throw new IllegalArgumentException({ kind: "invalid-plugin-version", raw });
    this.#major = BigInt(major);
    this.#minor = BigInt(minor);
    this.#patch = BigInt(patch);
  }

  static of(raw: string): PluginVersion {
    return new PluginVersion(raw);
  }

  static parse(raw: string): Result<PluginVersion, ParseError> {
    return parseConstruction(() => new PluginVersion(raw));
  }

  isOlderThan(other: PluginVersion): boolean {
    if (this.#major !== other.#major) return this.#major < other.#major;
    if (this.#minor !== other.#minor) return this.#minor < other.#minor;
    return this.#patch < other.#patch;
  }

  equals(other: PluginVersion): boolean {
    return this.#major === other.#major && this.#minor === other.#minor && this.#patch === other.#patch;
  }

  asString(): string {
    return `${this.#major}.${this.#minor}.${this.#patch}`;
  }

  asTag(): string {
    return `v${this.asString()}`;
  }
}
