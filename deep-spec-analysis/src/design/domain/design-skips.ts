import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignSkipped } from "./design-skipped.ts";

function sortDesignSkipped(skipped: readonly DesignSkipped[]): DesignSkipped[] {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

export class DesignSkips implements FirstClassCollection, IterableFirstClassCollection<DesignSkipped> {
  readonly #values: readonly DesignSkipped[];

  private constructor(values: readonly DesignSkipped[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignSkipped[]): DesignSkips {
    return new DesignSkips(values);
  }

  add(value: DesignSkipped): DesignSkips {
    return new DesignSkips([...this.#values, value]);
  }

  concat(other: DesignSkips): DesignSkips {
    return new DesignSkips([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<DesignSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): DesignSkips {
    return new DesignSkips(sortDesignSkipped(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly DesignSkipped[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
