import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { EnumMember } from "@deep-spec/kernel-domain";
// enum 属性の宣言値のコレクション（宣言順を保持——序数対応・文言順に効く）。
export class IrDeclaredValues {
  readonly #values: readonly EnumMember[];

  private constructor(values: readonly EnumMember[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "too-many-enum-members", raw: values.length });
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly EnumMember[]): IrDeclaredValues {
    return new IrDeclaredValues(values);
  }

  add(value: EnumMember): IrDeclaredValues {
    return new IrDeclaredValues([...this.#values, value]);
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
