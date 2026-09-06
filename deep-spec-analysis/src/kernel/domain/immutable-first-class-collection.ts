import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
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

/** 任意のドメイン要素を保持する不変コレクション。要素数上限は65,536件。 */
export class ImmutableFirstClassCollection<E extends Equatable<E>> implements FirstClassCollection<E> {
  readonly #values: readonly E[];

  private constructor(values: readonly E[]) {
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-immutable-collection-elements");
  }

  static of<E extends Equatable<E>>(values: readonly E[]): ImmutableFirstClassCollection<E> {
    return new ImmutableFirstClassCollection(values);
  }

  static parse<E extends Equatable<E>>(values: readonly E[]): Result<ImmutableFirstClassCollection<E>, ParseError> {
    return parseConstruction(() => new ImmutableFirstClassCollection(values));
  }

  [Symbol.iterator](): Iterator<E> {
    return this.#values[Symbol.iterator]();
  }

  at(index: number): E {
    return collectionAt(this, index);
  }

  head(): E {
    return collectionHead(this);
  }

  tail(): ImmutableFirstClassCollection<E> {
    return ImmutableFirstClassCollection.of(collectionTail(this));
  }

  include(element: E): boolean {
    return collectionInclude(this, element);
  }

  exists(predicate: (element: E) => boolean): boolean {
    return collectionExists(this, predicate);
  }

  filter(predicate: (element: E) => boolean): ImmutableFirstClassCollection<E> {
    return ImmutableFirstClassCollection.of(collectionFilter(this, predicate));
  }

  map<U extends Equatable<U>>(transform: (element: E) => U): ImmutableFirstClassCollection<U> {
    return ImmutableFirstClassCollection.of(collectionMap(this, transform));
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
