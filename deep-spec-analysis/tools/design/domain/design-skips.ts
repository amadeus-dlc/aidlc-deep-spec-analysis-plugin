import type { DesignSkipped } from "./design-skipped.ts";
import { IdOrder } from "../../kernel/domain/id-order.ts";

function sortDesignSkipped(skipped: readonly DesignSkipped[]): DesignSkipped[] {
  return [...skipped].sort((a, b) => {
    if (a.unit !== b.unit) return a.unit < b.unit ? -1 : 1;
    const c = IdOrder.compare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

export class DesignSkips {
  readonly #values: readonly DesignSkipped[];

  private constructor(values: readonly DesignSkipped[]) {
    this.#values = values;
  }

  static of(values: readonly DesignSkipped[]): DesignSkips {
    return new DesignSkips([...values]);
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
}
