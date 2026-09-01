import type { VerificationSkipped } from "./verification-skipped.ts";
import { IdOrder } from "../../kernel/domain/id-order.ts";

function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => {
    const c = IdOrder.compare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

export class VerificationSkips {
  readonly #values: readonly VerificationSkipped[];

  private constructor(values: readonly VerificationSkipped[]) {
    this.#values = values;
  }

  static of(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips([...values]);
  }

  add(value: VerificationSkipped): VerificationSkips {
    return new VerificationSkips([...this.#values, value]);
  }

  concat(other: VerificationSkips): VerificationSkips {
    return new VerificationSkips([...this.#values, ...other.#values]);
  }

  *[Symbol.iterator](): Iterator<VerificationSkipped> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationSkips {
    return new VerificationSkips(sortVerificationSkipped(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly VerificationSkipped[] {
    return this.#values;
  }
}
