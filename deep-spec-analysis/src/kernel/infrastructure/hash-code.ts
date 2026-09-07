// 値から 32 ビット符号付き整数のハッシュを作る純粋な計算基盤。
//
// `Equatable` の `equals` と対で使う。Java の契約に倣い、等しい 2 値は必ず等しい
// ハッシュを返す。逆は成り立たない——衝突は許される。
//
// 畳み込みは Java の `List.hashCode` と同じ形（初期値 1、`31 * h + element`）に
// する。乗数 31 は奇素数で、`31 * h` が `(h << 5) - h` に落ちるため実装が安定する。
//
// すべての演算を `| 0` で 32 ビットへ戻す。JavaScript の数値は倍精度なので、
// 戻さないと桁が伸びて畳み込みの分布が壊れる。

/** 畳み込みの初期値と乗数（Java の `List.hashCode` と同じ）。 */
const SEED = 1;
const MULTIPLIER = 31;

/** Java の `Boolean.hashCode` と同じ定数。 */
const TRUE_HASH = 1231;
const FALSE_HASH = 1237;

export function hashOfString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) hash = (MULTIPLIER * hash + value.charCodeAt(index)) | 0;
  return hash;
}

/**
 * 数値のハッシュ。`-0` は `0` と等しい（`-0 === 0`）ので同じ値へ正規化する。
 * `NaN` はどの値とも等しくならないため、ハッシュの一貫性は要求されない——0 を返す。
 */
export function hashOfNumber(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (Number.isSafeInteger(value)) return value === 0 ? 0 : value | 0;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  return (view.getInt32(0) ^ view.getInt32(4)) | 0;
}

export function hashOfBoolean(value: boolean): number {
  return value ? TRUE_HASH : FALSE_HASH;
}

/** 値が無いことのハッシュ。`null` と `undefined` を同じ 0 に写す。 */
export function hashOfNullable<T>(value: T | null | undefined, hash: (value: T) => number): number {
  return value === null || value === undefined ? 0 : hash(value);
}

/** 反復順に畳み込む。順序を持たない集合は、順序に依らない実装で上書きする。 */
export function combinedHash(hashes: Iterable<number>): number {
  let hash = SEED;
  for (const element of hashes) hash = (MULTIPLIER * hash + element) | 0;
  return hash;
}
