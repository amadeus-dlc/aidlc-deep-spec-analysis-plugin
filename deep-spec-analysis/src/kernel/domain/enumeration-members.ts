import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { EnumerationMember } from "./enumeration-member.ts";
import type { FirstClassCollection } from "./first-class-collection.ts";
import { FirstClassCollectionBase } from "./first-class-collection-base.ts";

const MAX_ENUMERATION_MEMBERS = 10_000;

// enum 宣言値のファーストクラスコレクション。宣言順＝SMT の序数符号化・
// Quint の集合リテラル順という凍結面なので順序を所有する。
export class EnumerationMembers
  extends FirstClassCollectionBase<EnumerationMember, EnumerationMembers>
  implements FirstClassCollection<EnumerationMember>
{
  readonly #values: readonly EnumerationMember[];

  private constructor(values: readonly EnumerationMember[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_ENUMERATION_MEMBERS, "too-many-enum-members");
  }

  protected override rebuild(values: readonly EnumerationMember[]): EnumerationMembers {
    return new EnumerationMembers(values);
  }

  static parse(values: readonly EnumerationMember[]): Result<EnumerationMembers, ParseError> {
    return parseConstruction(() => new EnumerationMembers(values));
  }

  static of(values: readonly EnumerationMember[]): EnumerationMembers {
    return new EnumerationMembers(values);
  }

  add(value: EnumerationMember): EnumerationMembers {
    return new EnumerationMembers([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<EnumerationMember> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.some((member) => member.matchesLiteral(value));
  }

  sortedUniqueCanonically(): EnumerationMembers {
    const members = new Map(this.#values.map((member) => [member.asString(), member]));
    return new EnumerationMembers([...members.values()].sort((a, b) => a.compareTo(b)));
  }

  indexOf(value: string): number {
    return this.#values.findIndex((member) => member.matchesLiteral(value));
  }

  valueAt(index: number): EnumerationMember | undefined {
    return this.#values[index];
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly EnumerationMember[] {
    return this.#values;
  }

  override isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
