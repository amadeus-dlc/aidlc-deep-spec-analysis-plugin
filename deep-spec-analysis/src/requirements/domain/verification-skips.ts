import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { VerificationSkipped } from "./verification-skipped.ts";

function sortVerificationSkipped(skipped: readonly VerificationSkipped[]): VerificationSkipped[] {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

export class VerificationSkips
  extends FirstClassCollectionBase<VerificationSkipped, VerificationSkips>
  implements FirstClassCollection<VerificationSkipped>
{
  readonly #values: readonly VerificationSkipped[];

  private constructor(values: readonly VerificationSkipped[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-verification-skips");
  }

  protected override rebuild(values: readonly VerificationSkipped[]): VerificationSkips {
    return new VerificationSkips(values);
  }

  static parse(values: readonly VerificationSkipped[]): Result<VerificationSkips, ParseError> {
    return parseConstruction(() => new VerificationSkips(values));
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

  override *[Symbol.iterator](): Iterator<VerificationSkipped> {
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
