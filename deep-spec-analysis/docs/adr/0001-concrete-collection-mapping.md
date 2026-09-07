# Preserve domain collection types during mapping

[日本語](0001-concrete-collection-mapping.ja.md)

A public `map` transforms elements within the collection's element type and returns the same concrete domain collection. Each concrete class declares the method and uses a protected `mapTo` helper to perform the bounded transformation and invoke its own construction policy. This keeps domain operations available after mapping and makes the destination visible in the concrete implementation.

The generic `ImmutableFirstClassCollection` and the public cross-element-type `map` contract are removed. We rejected retaining a generic fallback or requiring every caller to select a factory. Applications that need another domain representation should use an explicitly named conversion owned by that domain type; `mapTo` remains protected.

Nonempty collections retain their `of(head, tail)` construction contract when mapped. Empty-capable results from a manifest's `tail` and `filter` use `ManifestEntries`, whose elements are `ManifestEntry` domain values. Catalogs and indexes must rebuild their lookup data from the mapped entries and preserve relevant context; a selection-only rebuild must not silently discard transformed entries. Construction constraints and callback failures propagate without being caught by `map`.

This supersedes the generic mapping result described in [the 2026-09-06 collection decision](../decisions.md#typed-first-class-collection-operations-2026-09-06).

`combine(other)` joins collections of the same concrete type and returns that type. Sequence-like collections retain left-then-right order; sets and indexes retain their existing uniqueness and construction rules. Catalog combination preserves metadata from both sides and rejects contradictory metadata instead of silently overwriting it. The shared implementation is protected `combineTo`, with the same traversal budget as mapping.

`equals(other)` and `hashCode()` belong to the shared contract. `equals` walks both collections in iteration order and reports inequality when their lengths differ; element equality is delegated to the domain type itself. `hashCode` folds the element hashes in that same order as `31 * h + element`, so equal collections always hash equally. A set or index that needs a different equivalence overrides both together.

That pairing is the `Equatable` contract as well (owner decision 2026-09-07, the same `equals`/`hashCode` pair as Java). Every domain type that declares `equals` implements `hashCode`, folding exactly the values the equality check reads. The hashing primitives live in `kernel/infrastructure`: strings use Java's `String.hashCode` 31-multiplier fold, booleans use the same constants (1231/1237), and `-0` normalizes to `0`. Every fold returns to a 32-bit signed integer.

`count()` is the shared query for how many elements a collection holds. It returns 0 when empty and obeys the same traversal budget as the other operations. Paths that materialize the elements into an array only to read its length (`toArray().length`, `[...collection].length`) are replaced by this operation. A concrete type that can answer in constant time may override `count`; the fifteen existing types keep their override returning the length of the held array.

`foldLeft(initial, accumulate)` is a shared reduction: it visits elements in iteration order, passes exactly the accumulator and element to the callback, and returns the unchanged initial value for an empty collection. Its accumulator type is independent of the element type. It follows [Scala's foldLeft semantics](https://www.scala-lang.org/api/2.13.18/scala/collection/IterableOnceOps.html), while retaining the project's finite traversal budget and exception propagation.
