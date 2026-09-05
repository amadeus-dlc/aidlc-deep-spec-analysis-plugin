import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { EnumMember } from "@deep-spec/kernel-domain";
// enum 属性の宣言値のコレクション（宣言順を保持——decode の序数対応に効く）。
export class ReqAttributeValues {
  readonly #values: readonly EnumMember[];

  private constructor(values: readonly EnumMember[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "too-many-enum-members", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly EnumMember[]): ReqAttributeValues {
    return new ReqAttributeValues(values);
  }

  add(value: EnumMember): ReqAttributeValues {
    return new ReqAttributeValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<EnumMember> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.some((member) => member.matchesLiteral(value));
  }

  // 正準順で重複を除いた値の列（enumMap の値域検査と等式構築の凍結順。裁定 1）。
  sortedUniqueCanonically(): ReqAttributeValues {
    return new ReqAttributeValues([...new Map(this.#values.map((member) => [member.asString(), member])).values()].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly EnumMember[] {
    return this.#values;
  }
}
