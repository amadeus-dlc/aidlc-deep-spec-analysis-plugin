import type { Equatable } from "./equatable.ts";
import type { NonEmptyFirstClassCollection } from "./non-empty-first-class-collection.ts";

/** 空を許すコレクションの操作契約。isEmptyは保持する要素の有無を返す。 */
export interface FirstClassCollection<E extends Equatable<E>> extends NonEmptyFirstClassCollection<E> {
  isEmpty(): boolean;
  map(transform: (element: E) => E): FirstClassCollection<E>;
  combine(other: FirstClassCollection<E>): FirstClassCollection<E>;
}
