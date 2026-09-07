import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";
// RequirementIdentifiers — requirements.md が宣言する要件 id の集合（ファーストクラス
// コレクション）。要素は RequirementIdentifier、内側は KeySet（裁定 3-1、2026-09-03）。
// 外部文書からの抽出はadapterのResult境界、`has` は逆引き検証の問い。

import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { KeySet } from "./key-set.ts";
import type { RequirementIdentifier } from "./requirement-identifier.ts";

const MAX_REQUIREMENT_IDENTIFIERS = 65_536;

export class RequirementIdentifiers
  extends FirstClassCollectionBase<RequirementIdentifier, RequirementIdentifiers>
  implements FirstClassCollection<RequirementIdentifier>
{
  readonly #values: KeySet<RequirementIdentifier>;

  private constructor(values: readonly RequirementIdentifier[]) {
    super();
    const snapshot = boundedCollectionSnapshot(values, MAX_REQUIREMENT_IDENTIFIERS, "too-many-requirement-identifiers");
    this.#values = KeySet.of(snapshot);
  }

  protected override rebuild(values: readonly RequirementIdentifier[]): RequirementIdentifiers {
    return new RequirementIdentifiers(values);
  }

  static of(values: readonly RequirementIdentifier[]): RequirementIdentifiers {
    return new RequirementIdentifiers(values);
  }

  static parse(values: readonly RequirementIdentifier[]): Result<RequirementIdentifiers, ParseError> {
    return parseConstruction(() => new RequirementIdentifiers(values));
  }

  add(value: RequirementIdentifier): RequirementIdentifiers {
    if (this.#values.has(value)) return this;
    return new RequirementIdentifiers([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RequirementIdentifier> {
    yield* this.#values;
  }

  has(value: RequirementIdentifier): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly RequirementIdentifier[] {
    return this.#values.toArray();
  }

  // 境界: 描画・アダプタ専用。
  toStrings(): readonly string[] {
    return this.#values.toArray().map((v) => v.asString());
  }

  override isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
