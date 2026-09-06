import type { FirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { KeySet } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { LoweredIdentifier } from "./lowered-identifier.ts";

// 一つのloweringで発行した識別子。一意性と衝突しない追加採番を所有する。
export class IssuedLoweredIdentifiers implements FirstClassCollection {
  readonly #values: KeySet<LoweredIdentifier>;
  /** 一つの変換文書の識別子予算は65,536件。 */
  private constructor(values: readonly LoweredIdentifier[]) {
    if (values.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-lowered-identifiers", raw: values.length });
    const snapshot: LoweredIdentifier[] = [];
    for (const value of values) {
      if (snapshot.length === 65_536)
        throw new IllegalArgumentException({ kind: "too-many-lowered-identifiers", raw: snapshot.length + 1 });
      snapshot.push(value);
    }
    this.#values = KeySet.of(snapshot);
    if (this.#values.size() !== snapshot.length)
      throw new IllegalArgumentException({ kind: "duplicate-lowered-identifier" });
  }
  static of(values: readonly LoweredIdentifier[]): IssuedLoweredIdentifiers {
    return new IssuedLoweredIdentifiers(values);
  }
  static parse(values: readonly LoweredIdentifier[]): Result<IssuedLoweredIdentifiers, ParseError> {
    return parseConstruction(() => new IssuedLoweredIdentifiers(values));
  }
  *availableObligations(): IterableIterator<LoweredIdentifier> {
    let remaining = 65_536 - this.#values.size();
    for (let sequence = 1; sequence <= 65_536 && remaining > 0; sequence++) {
      const id = LoweredIdentifier.of(`OB-${sequence}`);
      if (this.#values.has(id)) continue;
      remaining--;
      yield id;
    }
  }

  isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
