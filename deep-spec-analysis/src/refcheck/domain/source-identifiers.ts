import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  RequirementIdentifier,
  type RequirementIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { SourceIdentifier } from "./source-identifier.ts";

export class SourceIdentifiers
  extends FirstClassCollectionBase<SourceIdentifier, SourceIdentifiers>
  implements FirstClassCollection<SourceIdentifier>
{
  readonly #values: readonly SourceIdentifier[];

  private constructor(values: readonly SourceIdentifier[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-source-identifiers");
  }

  protected rebuild(values: readonly SourceIdentifier[]): SourceIdentifiers {
    return new SourceIdentifiers(values);
  }

  static parse(values: readonly SourceIdentifier[]): Result<SourceIdentifiers, ParseError> {
    return parseConstruction(() => new SourceIdentifiers(values));
  }

  static of(values: readonly SourceIdentifier[]): SourceIdentifiers {
    return new SourceIdentifiers(values);
  }

  add(value: SourceIdentifier): SourceIdentifiers {
    return new SourceIdentifiers([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SourceIdentifier> {
    yield* this.#values;
  }

  // FD-R3: requirements.md に存在しない source id（値の昇順——凍結順）。
  valuesMissingFrom(known: RequirementIdentifiers): string[] {
    return this.#values
      .map((id) => id.asString())
      .filter((id) => {
        const parsed = RequirementIdentifier.parse(id);
        return !parsed.ok || !known.has(parsed.value);
      })
      .sort();
  }

  toArray(): readonly SourceIdentifier[] {
    return this.#values;
  }
}
