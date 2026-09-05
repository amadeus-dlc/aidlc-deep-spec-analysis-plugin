import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { EnumMember } from "@deep-spec/kernel-domain";
// enum 宣言値のファーストクラスコレクション。宣言順＝SMT の序数符号化・
// Quint の集合リテラル順という凍結面なので順序を所有する。
export class AttributeValues {
  readonly #values: readonly EnumMember[];

  private constructor(values: readonly EnumMember[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "too-many-enum-members", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly EnumMember[]): AttributeValues {
    return new AttributeValues(values);
  }

  add(value: EnumMember): AttributeValues {
    return new AttributeValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EnumMember> {
    yield* this.#values;
  }

  indexOf(value: string): number {
    return this.#values.findIndex((member) => member.matchesLiteral(value));
  }

  valueAt(index: number): EnumMember | undefined {
    return this.#values[index];
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly EnumMember[] {
    return this.#values;
  }
}
