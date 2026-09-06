import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  type KeySet,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { Obligation } from "./obligation.ts";
import type { ObligationIdentifier } from "./obligation-identifier.ts";

export class Obligations
  extends FirstClassCollectionBase<Obligation, Obligations>
  implements FirstClassCollection<Obligation>
{
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-obligations");
  }

  protected rebuild(values: readonly Obligation[]): Obligations {
    return new Obligations(values);
  }

  static parse(values: readonly Obligation[]): Result<Obligations, ParseError> {
    return parseConstruction(() => new Obligations(values));
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
}
