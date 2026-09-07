import type { Equatable } from "./equatable.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import { NonEmptyFirstClassCollectionBase } from "./non-empty-first-class-collection-base.ts";

/** 空を許すコレクションの基底。空判定は先頭要素だけを反復して確認する。 */
export abstract class FirstClassCollectionBase<E extends Equatable<E>, Self extends FirstClassCollection<E>>
  extends NonEmptyFirstClassCollectionBase<E, Self>
  implements FirstClassCollection<E>
{
  protected constructor() {
    super();
  }

  abstract override map(transform: (element: E) => E): Self;

  abstract override combine(other: Self): Self;

  isEmpty(): boolean {
    for (const _element of this) return false;
    return true;
  }
}
