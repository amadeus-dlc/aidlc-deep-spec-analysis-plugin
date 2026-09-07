import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import type { Equatable } from "./equatable.ts";

/** コレクション操作で一度に走査する要素数の上限。既存最大規模65,536に合わせる。 */
const MAX_COLLECTION_ELEMENTS = 65_536;

function invalidIndex(index: number): IllegalArgumentException {
  return new IllegalArgumentException({ kind: "invalid-collection-index", raw: index });
}

function checkReadBudget(operation: string, inspected: number): void {
  if (inspected >= MAX_COLLECTION_ELEMENTS)
    throw new IllegalArgumentException({ kind: `${operation}-too-large`, raw: inspected + 1 });
}

export function collectionAt<E>(source: Iterable<E>, index: number): E {
  if (!Number.isSafeInteger(index) || index < 0 || index >= MAX_COLLECTION_ELEMENTS) throw invalidIndex(index);
  let position = 0;
  for (const element of source) {
    if (position === index) return element;
    position++;
  }
  throw invalidIndex(index);
}

export function collectionHead<E>(source: Iterable<E>): E {
  for (const element of source) return element;
  throw new IllegalArgumentException({ kind: "empty-collection-head" });
}

export function collectionTail<E>(source: Iterable<E>): E[] {
  const tail: E[] = [];
  let inspected = 0;
  let foundHead = false;
  for (const element of source) {
    checkReadBudget("collection-tail", inspected);
    inspected++;
    if (!foundHead) {
      foundHead = true;
      continue;
    }
    tail.push(element);
  }
  if (!foundHead) throw new IllegalArgumentException({ kind: "empty-collection-tail" });
  return tail;
}

export function collectionInclude<E extends Equatable<E>>(source: Iterable<E>, target: E): boolean {
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-include", inspected);
    inspected++;
    if (element.equals(target)) return true;
  }
  return false;
}

export function collectionExists<E>(source: Iterable<E>, predicate: (element: E) => boolean): boolean {
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-exists", inspected);
    inspected++;
    if (predicate(element)) return true;
  }
  return false;
}

export function collectionFilter<E>(source: Iterable<E>, predicate: (element: E) => boolean): E[] {
  const values: E[] = [];
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-filter", inspected);
    inspected++;
    if (predicate(element)) values.push(element);
  }
  return values;
}

export function collectionMap<E, U>(source: Iterable<E>, transform: (element: E) => U): U[] {
  const values: U[] = [];
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-map", inspected);
    inspected++;
    values.push(transform(element));
  }
  return values;
}

/**
 * 反復順に要素を突き合わせる。長さが違えば等しくない。
 * 要素の等価関係はドメイン型自身の `equals` に委ねる。
 */
export function collectionEquals<E extends Equatable<E>>(left: Iterable<E>, right: Iterable<E>): boolean {
  const leftIterator = left[Symbol.iterator]();
  const rightIterator = right[Symbol.iterator]();
  let inspected = 0;
  for (;;) {
    checkReadBudget("collection-equals", inspected);
    inspected++;
    const leftStep = leftIterator.next();
    const rightStep = rightIterator.next();
    if (leftStep.done === true || rightStep.done === true) return leftStep.done === rightStep.done;
    if (!leftStep.value.equals(rightStep.value)) return false;
  }
}

/** `collectionEquals` と対。反復順に要素のハッシュを畳み込む。 */
export function collectionHashCode<E extends Equatable<E>>(source: Iterable<E>): number {
  let hash = 1;
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-hash-code", inspected);
    inspected++;
    hash = (31 * hash + element.hashCode()) | 0;
  }
  return hash;
}

export function collectionCount<E>(source: Iterable<E>): number {
  let inspected = 0;
  for (const _element of source) {
    checkReadBudget("collection-count", inspected);
    inspected++;
  }
  return inspected;
}

export function collectionCombine<E>(left: Iterable<E>, right: Iterable<E>): E[] {
  const values: E[] = [];
  for (const source of [left, right])
    for (const element of source) {
      checkReadBudget("collection-combine", values.length);
      values.push(element);
    }
  return values;
}

export function collectionFoldLeft<E, A>(
  source: Iterable<E>,
  initial: A,
  accumulate: (accumulator: A, element: E) => A,
): A {
  let accumulator = initial;
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-fold-left", inspected);
    inspected++;
    accumulator = accumulate(accumulator, element);
  }
  return accumulator;
}
