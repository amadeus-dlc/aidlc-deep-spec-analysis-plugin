// 配布プラグインの stable Semantic Version。Git tag の任意の `v` 接頭辞を
// 入口で正規化し、比較判断を値オブジェクト自身に閉じる。
export class PluginVersion {
  readonly #major: bigint;
  readonly #minor: bigint;
  readonly #patch: bigint;

  private constructor(major: bigint, minor: bigint, patch: bigint) {
    this.#major = major;
    this.#minor = minor;
    this.#patch = patch;
  }

  static parse(raw: string): PluginVersion | null {
    const match = raw.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    const major = match?.[1];
    const minor = match?.[2];
    const patch = match?.[3];
    if (major === undefined || minor === undefined || patch === undefined) return null;
    return new PluginVersion(BigInt(major), BigInt(minor), BigInt(patch));
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
