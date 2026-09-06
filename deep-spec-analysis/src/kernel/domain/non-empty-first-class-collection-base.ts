import {
  collectionAt,
  collectionExists,
  collectionFilter,
  collectionHead,
  collectionInclude,
  collectionMap,
  collectionTail,
} from "./collection-operations.ts";
import type { Equatable } from "./equatable.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import { ImmutableFirstClassCollection } from "./immutable-first-class-collection.ts";
import type { NonEmptyFirstClassCollection } from "./non-empty-first-class-collection.ts";

/** 要素操作の基底実装。非空の保証は具象型が担い、空判定は FirstClassCollection に委ねる。 */
export abstract class NonEmptyFirstClassCollectionBase<
  E extends Equatable<E>,
  Rest extends FirstClassCollection<E> = FirstClassCollection<E>,
> implements NonEmptyFirstClassCollection<E>
{
  protected constructor() {}

  abstract [Symbol.iterator](): Iterator<E>;

  protected abstract rebuild(values: readonly E[]): Rest;

  at(index: number): E {
    return collectionAt(this, index);
  }

  head(): E {
    return collectionHead(this);
  }

  tail(): Rest {
    return this.rebuild(collectionTail(this));
  }

  include(element: E): boolean {
    return collectionInclude(this, element);
  }

  exists(predicate: (element: E) => boolean): boolean {
    return collectionExists(this, predicate);
  }

  filter(predicate: (element: E) => boolean): Rest {
    return this.rebuild(collectionFilter(this, predicate));
  }

  map<U extends Equatable<U>>(transform: (element: E) => U): FirstClassCollection<U> {
    return ImmutableFirstClassCollection.of(collectionMap(this, transform));
  }
}
