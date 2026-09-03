// KeyedIndex — ドメインプリミティブをキーにする索引の表現プリミティブ
//（種別規律の裁定 3-1、2026-09-03）。JS の Map はオブジェクトキーを同一性で
// 比べるため、DP キーの検索は最内層で `asString()` に落とすしかない。その
// string キーの Map を持つのは kernel のこのファイル（と KeySet）だけで、
// DP ラッパーの唯一の `#value` と同じ理屈で primitive フィールド規則の恒久除外
// に載る。domain の索引はすべて `KeyedIndex<DP, …>` で持ち、string キーは
// domain のどこにも現れない。挿入順を保つ（Map と同じ——既存キーへの再設定は
// 位置を保ち値だけ替わる）。不変——`with` は新しい索引を返す。

export class KeyedIndex<K extends { asString(): string }, V> {
  readonly #entries: ReadonlyMap<string, readonly [K, V]>;

  private constructor(entries: ReadonlyMap<string, readonly [K, V]>) {
    this.#entries = entries;
  }

  static empty<K extends { asString(): string }, V>(): KeyedIndex<K, V> {
    return new KeyedIndex<K, V>(new Map());
  }

  static of<K extends { asString(): string }, V>(entries: Iterable<readonly [K, V]>): KeyedIndex<K, V> {
    const map = new Map<string, readonly [K, V]>();
    for (const [key, value] of entries) map.set(key.asString(), [key, value]);
    return new KeyedIndex<K, V>(map);
  }

  with(key: K, value: V): KeyedIndex<K, V> {
    const map = new Map(this.#entries);
    map.set(key.asString(), [key, value]);
    return new KeyedIndex<K, V>(map);
  }

  get(key: K): V | undefined {
    return this.#entries.get(key.asString())?.[1];
  }

  has(key: K): boolean {
    return this.#entries.has(key.asString());
  }

  size(): number {
    return this.#entries.size;
  }

  isEmpty(): boolean {
    return this.#entries.size === 0;
  }

  *keys(): IterableIterator<K> {
    for (const [key] of this.#entries.values()) yield key;
  }

  *values(): IterableIterator<V> {
    for (const [, value] of this.#entries.values()) yield value;
  }

  *[Symbol.iterator](): Iterator<readonly [K, V]> {
    yield* this.#entries.values();
  }
}
