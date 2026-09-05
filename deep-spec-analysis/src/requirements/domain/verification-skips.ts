import type { VerificationSkipped } from "./verification-skipped.ts";

function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

export class VerificationSkips {
  readonly #values: readonly VerificationSkipped[];

  private constructor(values: readonly VerificationSkipped[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips(values);
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
