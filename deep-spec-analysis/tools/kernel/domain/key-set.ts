// KeySet — ドメインプリミティブの集合の表現プリミティブ（種別規律の裁定
// 3-1、2026-09-03）。KeyedIndex と同じ理屈で、DP を `asString()` で引く string
// キーの Map をここだけが持つ。挿入順を保ち、不変（`with` は新しい集合）。

export class KeySet<K extends { asString(): string }> {
  readonly #values: ReadonlyMap<string, K>;

  private constructor(values: ReadonlyMap<string, K>) {
    this.#values = values;
  }

  static empty<K extends { asString(): string }>(): KeySet<K> {
    return new KeySet<K>(new Map());
  }

  static of<K extends { asString(): string }>(keys: Iterable<K>): KeySet<K> {
    const map = new Map<string, K>();
    for (const key of keys) if (!map.has(key.asString())) map.set(key.asString(), key);
    return new KeySet<K>(map);
  }

  with(key: K): KeySet<K> {
    if (this.#values.has(key.asString())) return this;
    const map = new Map(this.#values);
    map.set(key.asString(), key);
    return new KeySet<K>(map);
  }

  has(key: K): boolean {
    return this.#values.has(key.asString());
  }

  size(): number {
    return this.#values.size;
  }

  isEmpty(): boolean {
    return this.#values.size === 0;
  }

  *[Symbol.iterator](): Iterator<K> {
    yield* this.#values.values();
  }

  toArray(): readonly K[] {
    return [...this.#values.values()];
  }
}
