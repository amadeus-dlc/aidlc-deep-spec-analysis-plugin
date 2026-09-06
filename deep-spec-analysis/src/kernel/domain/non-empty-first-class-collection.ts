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
  map<U extends Equatable<U>>(transform: (element: E) => U): FirstClassCollection<U>;
}
