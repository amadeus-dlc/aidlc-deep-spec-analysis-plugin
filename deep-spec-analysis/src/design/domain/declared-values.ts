import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { EnumMember } from "@deep-spec/kernel-domain";
// ---- ファーストクラスコレクション（decl 束） --------------------------------
// ドメイン層は配列を生で運ばない。巡回・所属・宣言値の照合という集合の知識は
// コレクションが所有し、toArray() は境界専用の脱出口。

export class DeclaredValues {
  readonly #values: readonly EnumMember[];

  private constructor(values: readonly EnumMember[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "too-many-enum-members", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly EnumMember[]): DeclaredValues {
    return new DeclaredValues(values);
  }

  add(value: EnumMember): DeclaredValues {
    return new DeclaredValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EnumMember> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.some((member) => member.matchesLiteral(value));
  }

  toArray(): readonly EnumMember[] {
    return this.#values;
  }
}
