import type { AttributeDeclaration } from "./attribute-declaration.ts";
import type { AttributeName } from "./attribute-name.ts";

// 属性宣言のコレクション。重複検出・ライフサイクル属性の選定・名前解決という
// 集合の知識を所有する。
export class AttributeDeclarations {
  readonly #values: readonly AttributeDeclaration[];

  private constructor(values: readonly AttributeDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly AttributeDeclaration[]): AttributeDeclarations {
    return new AttributeDeclarations(values);
  }

  add(value: AttributeDeclaration): AttributeDeclarations {
    return new AttributeDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeDeclaration> {
    yield* this.#values;
  }

  // 2 回目以降に現れた属性宣言（宣言順——旧 seen-set 走査と同じ列）。
  duplicatesByName(): AttributeDeclaration[] {
    const seen = new Set<string>();
    const dups: AttributeDeclaration[] = [];
    for (const a of this.#values) {
      if (seen.has(a.name().asString())) dups.push(a);
      seen.add(a.name().asString());
    }
    return dups;
  }

  // ライフサイクル属性：status/state の名で allowed を持つもの、無ければ
  // allowed を持つ唯一の属性、それも無ければ null（旧 lifecycleAttrOf）。
  lifecycleAttr(): AttributeDeclaration | null {
    const named = this.#values.find((a) => a.bearsLifecycleName() && a.hasAllowedValues());
    if (named) return named;
    const withAllowed = this.#values.filter((a) => a.hasAllowedValues());
    return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
  }

  named(token: string): AttributeDeclaration | null {
    return this.#values.find((a) => a.name().asString() === token) ?? null;
  }

  names(): AttributeName[] {
    return this.#values.map((a) => a.name());
  }

  toArray(): readonly AttributeDeclaration[] {
    return this.#values;
  }
}
