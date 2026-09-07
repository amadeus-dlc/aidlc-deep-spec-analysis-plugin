import {
  collectionAt,
  collectionCombine,
  collectionCount,
  collectionEquals,
  collectionExists,
  collectionFilter,
  collectionFoldLeft,
  collectionHashCode,
  collectionHead,
  collectionInclude,
  collectionMap,
  collectionTail,
} from "./collection-operations.ts";
import type { Equatable } from "./equatable.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
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

  abstract map(transform: (element: E) => E): NonEmptyFirstClassCollection<E>;

  abstract combine(other: NonEmptyFirstClassCollection<E>): NonEmptyFirstClassCollection<E>;

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

  equals(other: NonEmptyFirstClassCollection<E>): boolean {
    return this === other || collectionEquals(this, other);
  }

  hashCode(): number {
    return collectionHashCode(this);
  }

  count(): number {
    return collectionCount(this);
  }

  foldLeft<A>(initial: A, accumulate: (accumulator: A, element: E) => A): A {
    return collectionFoldLeft(this, initial, accumulate);
  }

  protected mapTo<U extends Equatable<U>, Collection extends NonEmptyFirstClassCollection<U>>(
    transform: (element: E) => U,
    factory: (values: readonly U[]) => Collection,
  ): Collection {
    return factory(collectionMap(this, transform));
  }

  protected combineTo<Collection extends NonEmptyFirstClassCollection<E>>(
    other: NonEmptyFirstClassCollection<E>,
    factory: (values: readonly E[]) => Collection,
  ): Collection {
    return factory(collectionCombine(this, other));
  }
}
