import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ObligationIdentifier } from "./obligation-identifier.ts";

// 義務のファーストクラスコレクション。id 検索と id 列の導出を所有する。
// 義務 id のファーストクラスコレクション(plan のイベント義務面など、
// 部分集合の id 列を運ぶ)。宣言順を保持し、toStrings() は境界(照会 API・
// TargetIdentifiers/functionalRequirementReferencesOf の生 id 材料)専用の脱出口。
export class ObligationIdentifiers
  extends FirstClassCollectionBase<ObligationIdentifier, ObligationIdentifiers>
  implements FirstClassCollection<ObligationIdentifier>
{
  readonly #values: readonly ObligationIdentifier[];

  private constructor(values: readonly ObligationIdentifier[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-obligation-identifiers");
  }

  protected rebuild(values: readonly ObligationIdentifier[]): ObligationIdentifiers {
    return new ObligationIdentifiers(values);
  }

  static parse(values: readonly ObligationIdentifier[]): Result<ObligationIdentifiers, ParseError> {
    return parseConstruction(() => new ObligationIdentifiers(values));
  }

  static of(values: readonly ObligationIdentifier[]): ObligationIdentifiers {
    return new ObligationIdentifiers(values);
  }

  add(value: ObligationIdentifier): ObligationIdentifiers {
    return new ObligationIdentifiers([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ObligationIdentifier> {
    yield* this.#values;
  }

  toStrings(): string[] {
    return this.#values.map((v) => v.asString());
  }

  // 検査対象 id 列としての面（宣言順を保つ）。
  toTargetIds(): TargetIdentifiers {
    return TargetIdentifiers.of(this.#values.map((v) => v.asTargetId()));
  }
}
