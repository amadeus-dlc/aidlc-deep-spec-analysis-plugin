import type { Equatable } from "./equatable.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";

/** 要素操作の基底契約。非空の保証は具象型が担い、空判定は FirstClassCollection に委ねる。 */
export interface NonEmptyFirstClassCollection<E extends Equatable<E>> extends Iterable<E> {
  /** 0始まり。負値・非整数・範囲外は契約違反。 */
  at(index: number): E;
  /** 空での呼出しは契約違反。 */
  head(): E;
  /** 空での呼出しは契約違反。 */
  tail(): FirstClassCollection<E>;
  include(element: E): boolean;
  /** 真になった時点で短絡する。 */
  exists(predicate: (element: E) => boolean): boolean;
  filter(predicate: (element: E) => boolean): FirstClassCollection<E>;
  map(transform: (element: E) => E): NonEmptyFirstClassCollection<E>;
  combine(other: NonEmptyFirstClassCollection<E>): NonEmptyFirstClassCollection<E>;
  /** 反復順に要素を突き合わせた等価関係。要素の等価はドメイン型自身に委ねる。 */
  equals(other: NonEmptyFirstClassCollection<E>): boolean;
  /** `equals` と対のハッシュ。等しいコレクションは等しいハッシュを返す。 */
  hashCode(): number;
  /** 保持する要素数。走査上限を超える反復は契約違反。 */
  count(): number;
  /** 初期値から反復順に畳み込む。空なら初期値をそのまま返す。 */
  foldLeft<A>(initial: A, accumulate: (accumulator: A, element: E) => A): A;
}
