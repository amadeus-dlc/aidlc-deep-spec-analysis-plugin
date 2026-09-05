import { RequirementIdentifier, type RequirementIdentifiers } from "@deep-spec/kernel-domain";
import { SourceIdentifier } from "./source-identifier.ts";

export class SourceIdentifiers {
  readonly #values: readonly SourceIdentifier[];

  private constructor(values: readonly SourceIdentifier[]) {
    this.#values = Object.freeze([...values]);
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
    return this.#values.map((id) => id.asString()).filter((id) => {
      const parsed = RequirementIdentifier.parse(id);
      return !parsed.ok || !known.has(parsed.value);
    }).sort();
  }

  toArray(): readonly SourceIdentifier[] {
    return this.#values;
  }
}
