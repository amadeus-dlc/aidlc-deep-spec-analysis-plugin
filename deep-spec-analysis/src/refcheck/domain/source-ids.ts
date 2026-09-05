import { RequirementId, type RequirementIds } from "@deep-spec/kernel-domain";
import { SourceId } from "./source-id.ts";

export class SourceIds {
  readonly #values: readonly SourceId[];

  private constructor(values: readonly SourceId[]) {
    this.#values = values;
  }

  static of(values: readonly SourceId[]): SourceIds {
    return new SourceIds([...values]);
  }

  add(value: SourceId): SourceIds {
    return new SourceIds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SourceId> {
    yield* this.#values;
  }

  // FD-R3: requirements.md に存在しない source id（値の昇順——凍結順）。
  valuesMissingFrom(known: RequirementIds): string[] {
    return this.#values.map((id) => id.asString()).filter((id) => !known.has(RequirementId.of(id))).sort();
  }

  toArray(): readonly SourceId[] {
    return this.#values;
  }
}
