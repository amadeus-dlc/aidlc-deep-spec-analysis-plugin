import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { type KeySet, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import type { Obligation } from "./obligation.ts";
import type { ObligationIdentifier } from "./obligation-identifier.ts";

export class Obligations implements FirstClassCollection, IterableFirstClassCollection<Obligation> {
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Obligation[]): Obligations {
    return new Obligations(values);
  }

  add(value: Obligation): Obligations {
    return new Obligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Obligation> {
    yield* this.#values;
  }

  compiledInvariantTargets(compiled: KeySet<ObligationIdentifier>): TargetIdentifiers {
    return TargetIdentifiers.of(
      this.#values
        .filter((obligation) => obligation.isInvariantLike() && compiled.has(obligation.id()))
        .map((obligation) => obligation.id().asTargetId()),
    );
  }

  byId(id: string): Obligation | undefined {
    return this.#values.find((o) => o.id().asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id().asString());
  }

  toArray(): readonly Obligation[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
