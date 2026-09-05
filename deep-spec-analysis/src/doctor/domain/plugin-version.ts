import { type Result, IllegalArgumentException, parseConstruction } from "@deep-spec/kernel-infrastructure";

// 配布プラグインの stable Semantic Version。Git tag の任意の `v` 接頭辞を
// 入口で正規化し、比較判断を値オブジェクト自身に閉じる。
export class PluginVersion {
  readonly #major: bigint;
  readonly #minor: bigint;
  readonly #patch: bigint;

  private constructor(raw: string) {
    const match = raw.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    const major = match?.[1];
    const minor = match?.[2];
    const patch = match?.[3];
    if (major === undefined || minor === undefined || patch === undefined) throw new IllegalArgumentException({ kind: "invalid-plugin-version", raw });
    this.#major = BigInt(major);
    this.#minor = BigInt(minor);
    this.#patch = BigInt(patch);
  }

  static of(raw: string): PluginVersion { return new PluginVersion(raw); }

  static parse(raw: string): Result<PluginVersion, IllegalArgumentException["problem"]> {
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
