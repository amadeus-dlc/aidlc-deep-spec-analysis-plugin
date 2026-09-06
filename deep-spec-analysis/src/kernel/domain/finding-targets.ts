import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IterableFirstClassCollection } from "./iterable-first-class-collection.ts";
import type { TargetIdentifier } from "./target-identifier.ts";

export const MAX_FINDING_TARGETS = 65_536;

/** 診断1件は必ず対象を持つ。対象列の予算は65,536件で、宣言順と重複を保持する。 */
export class FindingTargets implements IterableFirstClassCollection<TargetIdentifier> {
  readonly #values: readonly TargetIdentifier[];

  private constructor(head: TargetIdentifier, tail: readonly TargetIdentifier[]) {
    if (tail.length >= MAX_FINDING_TARGETS)
      throw new IllegalArgumentException({ kind: "too-many-finding-targets", raw: tail.length + 1 });
    const snapshot: TargetIdentifier[] = [head];
    for (const value of tail) {
      if (snapshot.length === MAX_FINDING_TARGETS)
        throw new IllegalArgumentException({ kind: "too-many-finding-targets", raw: snapshot.length + 1 });
      snapshot.push(value);
    }
    this.#values = Object.freeze(snapshot);
  }

  static of(head: TargetIdentifier, tail: readonly TargetIdentifier[]): FindingTargets {
    return new FindingTargets(head, tail);
  }

  static parse(head: TargetIdentifier, tail: readonly TargetIdentifier[]): Result<FindingTargets, ParseError> {
    return parseConstruction(() => new FindingTargets(head, tail));
  }

  *[Symbol.iterator](): Iterator<TargetIdentifier> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  includes(value: TargetIdentifier): boolean {
    return this.#values.some((target) => target.equals(value));
  }

  sortedCanonically(): FindingTargets {
    const [head, ...tail] = [...this.#values].sort((a, b) => a.compareTo(b));
    return new FindingTargets(head, tail);
  }

  sortedUniqueCanonically(): FindingTargets {
    const unique = new Map(this.#values.map((target) => [target.asString(), target]));
    const [head, ...tail] = [...unique.values()].sort((a, b) => a.compareTo(b));
    return new FindingTargets(head, tail);
  }

  joined(separator: string): string {
    return this.toStrings().join(separator);
  }

  toArray(): readonly TargetIdentifier[] {
    return this.#values;
  }

  toStrings(): string[] {
    return this.#values.map((target) => target.asString());
  }
}
